import { TRPCError } from '@trpc/server'
import {
  and,
  asc,
  eq,
  exists,
  gt,
  inArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { z } from 'zod/v4'

import { db } from '#/db/index.ts'
import { connections, fileIndex, fileTags } from '#/db/schema/index.ts'
import {
  listConnectionsForOrganization,
  listVisibleConnectionsForUser,
} from '#/lib/connection-repository.ts'
import {
  canRead,
  canWrite,
  deleteScopedPermissions,
  getExplorerGrantedFolderPaths,
  getPermissionContext,
  isExplorerIndexedEntryVisible,
  isOrganizationAdminRole,
  renameScopedPermissions,
  resolvePermissionFromContext,
  resolvePermission,
} from '#/lib/permissions.ts'
import { permissionAccessSchema } from '#/lib/connections.ts'
import { colorKeySchema, iconValueSchema } from '#/lib/tags.ts'
import {
  indexDeleteEntry,
  indexInsertEntry,
  indexRenameEntry,
  listFromIndexBatch,
} from '#/lib/indexing/index.ts'
import { resolveProvider } from '#/lib/storage/index.ts'
import { normalizePath, PathError } from '#/lib/storage/path-utils.ts'

import { createTRPCRouter, organizationProcedure } from '../init'

const fileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDirectory: z.boolean(),
  size: z.number().nullable(),
  mimeType: z.string().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  lastModified: z.date().nullable(),
})

const fileListEntrySchema = fileEntrySchema.extend({
  access: permissionAccessSchema,
})

const listCursorSchema = z.object({
  folderOffset: z.number().int().min(0),
  fileOffset: z.number().int().min(0),
})

const listResultSchema = z.object({
  path: z.string(),
  currentAccess: permissionAccessSchema,
  entries: z.array(fileListEntrySchema),
  hasMore: z.boolean(),
  nextCursor: listCursorSchema.nullable(),
})

const fileSearchResultItemSchema = z.object({
  connectionId: z.string(),
  connectionName: z.string(),
  path: z.string(),
  name: z.string(),
  isDirectory: z.boolean(),
  color: z.string().nullable(),
})

const fileSearchSqlCursorSchema = z.object({
  connectionId: z.string(),
  name: z.string(),
  path: z.string(),
})

const filesSearchResultSchema = z.object({
  items: z.array(fileSearchResultItemSchema),
  hasMore: z.boolean(),
  nextCursor: fileSearchSqlCursorSchema.nullable(),
})

const filesSearchInputSchema = z
  .object({
    query: z.string().optional(),
    connectionIds: z.array(z.string().min(1)).optional(),
    tagIds: z.array(z.string().min(1)).optional(),
    colors: z.array(colorKeySchema).optional(),
    pathPrefix: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(30),
    cursor: fileSearchSqlCursorSchema.optional(),
    direction: z.enum(['forward', 'backward']).optional(),
  })
  .superRefine((data, ctx) => {
    const q = data.query?.trim() ?? ''
    const hasText = q.length > 0
    const pp = data.pathPrefix?.trim() ?? ''
    const hasPathPrefix = pp.length > 0
    const hasFilters =
      (data.connectionIds?.length ?? 0) > 0 ||
      (data.tagIds?.length ?? 0) > 0 ||
      (data.colors?.length ?? 0) > 0 ||
      hasPathPrefix
    if (!hasText && !hasFilters) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a search query or choose at least one filter.',
      })
    }
  })

function escapeLikePattern(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
}

function ilikeSubstringCondition(raw: string): SQL {
  const escaped = escapeLikePattern(raw.trim())
  const pattern = `%${escaped}%`
  return or(
    sql`lower(${fileIndex.name}) LIKE lower(${pattern}) ESCAPE '\\'`,
    sql`lower(${fileIndex.path}) LIKE lower(${pattern}) ESCAPE '\\'`,
  )!
}

/** Match indexed paths under `prefix` (inclusive): the folder itself or any descendant path. */
function pathUnderPrefixCondition(normalizedPrefix: string): SQL {
  const escaped = escapeLikePattern(normalizedPrefix)
  const pattern = `${escaped}/%`
  return or(
    eq(fileIndex.path, normalizedPrefix),
    sql`lower(${fileIndex.path}) LIKE lower(${pattern}) ESCAPE '\\'`,
  )!
}

function sqlOrderedAfterCursor(
  cursor: z.infer<typeof fileSearchSqlCursorSchema>,
): SQL {
  return or(
    gt(fileIndex.connectionId, cursor.connectionId),
    and(
      eq(fileIndex.connectionId, cursor.connectionId),
      gt(fileIndex.name, cursor.name),
    ),
    and(
      eq(fileIndex.connectionId, cursor.connectionId),
      eq(fileIndex.name, cursor.name),
      gt(fileIndex.path, cursor.path),
    ),
  )!
}

function pathName(path: string) {
  return path.split('/').filter(Boolean).at(-1) ?? ''
}

function safeNormalize(path: string) {
  try {
    return normalizePath(path)
  } catch (e) {
    if (e instanceof PathError) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
    }
    throw e
  }
}

async function requireReadPermission(
  userId: string,
  organizationId: string,
  connectionId: string,
  path: string,
) {
  const access = await resolvePermission(
    userId,
    organizationId,
    connectionId,
    path,
  )

  if (!canRead(access)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this path.',
    })
  }
}

async function requireWritePermission(
  userId: string,
  organizationId: string,
  connectionId: string,
  path: string,
) {
  const access = await resolvePermission(
    userId,
    organizationId,
    connectionId,
    path,
  )

  if (!canWrite(access)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have write access to this path.',
    })
  }
}

export const filesRouter = createTRPCRouter({
  list: organizationProcedure
    .input(
      z.object({
        connectionId: z.string().min(1),
        path: z.string(),
        cursor: listCursorSchema.nullish(),
        limit: z.number().int().min(1).max(100).default(100),
      }),
    )
    .output(listResultSchema)
    .query(async ({ ctx, input }) => {
      const path = safeNormalize(input.path)
      const pageLimit = input.limit
      const cursor = input.cursor ?? { folderOffset: 0, fileOffset: 0 }
      const permissionContext = await getPermissionContext(
        ctx.sessionData.user.id,
        ctx.organizationId,
        input.connectionId,
      )

      if (!permissionContext) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this connection.',
        })
      }

      const currentAccess = resolvePermissionFromContext(
        path,
        permissionContext,
      )
      const grantedFolderPaths =
        getExplorerGrantedFolderPaths(permissionContext)
      const hasDescendantAccess =
        !isOrganizationAdminRole(permissionContext.organizationRole) &&
        grantedFolderPaths.some(
          (entryPath) =>
            path === '/' ||
            entryPath.startsWith(`${path}/`) ||
            entryPath === path,
        )

      if (!canRead(currentAccess) && !hasDescendantAccess) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this path.',
        })
      }

      const isVisibleEntry = (entry: {
        isDirectory: boolean
        access: (typeof permissionAccessSchema)['_output']
        path: string
      }) =>
        isExplorerIndexedEntryVisible(
          permissionContext,
          grantedFolderPaths,
          entry,
        )

      const visibleEntries: Array<z.infer<typeof fileListEntrySchema>> = []
      let folderOffset = cursor.folderOffset
      let fileOffset = cursor.fileOffset
      let foldersExhausted = false
      let filesExhausted = false
      const scanBatchSize = Math.max(pageLimit, 100)

      while (
        visibleEntries.length < pageLimit &&
        (!foldersExhausted || !filesExhausted)
      ) {
        if (!foldersExhausted) {
          const folderBatch = await listFromIndexBatch({
            connectionId: input.connectionId,
            parentPath: path,
            isDirectory: true,
            offset: folderOffset,
            limit: scanBatchSize,
          })
          folderOffset += folderBatch.length
          if (folderBatch.length < scanBatchSize) {
            foldersExhausted = true
          }

          for (const entry of folderBatch) {
            const entryWithAccess = {
              ...entry,
              access: resolvePermissionFromContext(
                entry.path,
                permissionContext,
              ),
            }

            if (!isVisibleEntry(entryWithAccess)) {
              continue
            }

            visibleEntries.push(entryWithAccess)
            if (visibleEntries.length >= pageLimit) {
              break
            }
          }

          if (visibleEntries.length >= pageLimit) {
            break
          }
        }

        if (!filesExhausted) {
          const remainingSlots = pageLimit - visibleEntries.length
          const fileBatch = await listFromIndexBatch({
            connectionId: input.connectionId,
            parentPath: path,
            isDirectory: false,
            offset: fileOffset,
            limit: Math.max(remainingSlots, scanBatchSize),
          })
          fileOffset += fileBatch.length
          if (fileBatch.length < Math.max(remainingSlots, scanBatchSize)) {
            filesExhausted = true
          }

          for (const entry of fileBatch) {
            const entryWithAccess = {
              ...entry,
              access: resolvePermissionFromContext(
                entry.path,
                permissionContext,
              ),
            }

            if (!isVisibleEntry(entryWithAccess)) {
              continue
            }

            visibleEntries.push(entryWithAccess)
            if (visibleEntries.length >= pageLimit) {
              break
            }
          }
        }
      }

      const hasMore = !foldersExhausted || !filesExhausted
      const nextCursor = hasMore
        ? {
            folderOffset,
            fileOffset,
          }
        : null

      return {
        path,
        currentAccess,
        entries: visibleEntries,
        hasMore,
        nextCursor,
      }
    }),

  search: organizationProcedure
    .input(filesSearchInputSchema)
    .output(filesSearchResultSchema)
    .query(async ({ ctx, input }) => {
      const allowedRows = isOrganizationAdminRole(ctx.organizationRole)
        ? await listConnectionsForOrganization(ctx.organizationId)
        : await listVisibleConnectionsForUser(
            ctx.organizationId,
            ctx.sessionData.user.id,
          )
      const allowedIdSet = new Set(allowedRows.map((row) => row.id))

      let searchConnectionIds: string[]
      if (input.connectionIds?.length) {
        for (const id of input.connectionIds) {
          if (!allowedIdSet.has(id)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Invalid connection filter.',
            })
          }
        }
        searchConnectionIds = input.connectionIds
      } else {
        searchConnectionIds = [...allowedIdSet]
      }

      if (searchConnectionIds.length === 0) {
        return { items: [], hasMore: false, nextCursor: null }
      }

      const tagIdsFilter = input.tagIds
      if (tagIdsFilter?.length) {
        const tagRows = await db.query.tags.findMany({
          where: (t, operators) =>
            operators.and(
              operators.eq(t.organizationId, ctx.organizationId),
              operators.inArray(t.id, tagIdsFilter),
            ),
          columns: { id: true },
        })
        if (tagRows.length !== tagIdsFilter.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'One or more tags were not found.',
          })
        }
      }

      const trimmedQuery = input.query?.trim() ?? ''
      const conditions: SQL[] = [
        eq(connections.organizationId, ctx.organizationId),
        inArray(fileIndex.connectionId, searchConnectionIds),
      ]

      const pathPrefixRaw = input.pathPrefix?.trim() ?? ''
      if (pathPrefixRaw.length > 0) {
        const normalizedPrefix = safeNormalize(pathPrefixRaw)
        conditions.push(pathUnderPrefixCondition(normalizedPrefix))
      }

      if (trimmedQuery.length > 0) {
        conditions.push(ilikeSubstringCondition(trimmedQuery))
      }

      if (input.colors?.length) {
        conditions.push(inArray(fileIndex.color, input.colors))
      }

      if (tagIdsFilter?.length) {
        const tagMatch = db
          .select({ value: sql`1` })
          .from(fileTags)
          .where(
            and(
              eq(fileTags.fileId, fileIndex.id),
              inArray(fileTags.tagId, tagIdsFilter),
            ),
          )
        conditions.push(exists(tagMatch))
      }

      if (input.cursor) {
        conditions.push(sqlOrderedAfterCursor(input.cursor))
      }

      const pageSize = input.limit
      const rows = await db
        .select({
          connectionId: fileIndex.connectionId,
          connectionName: connections.name,
          path: fileIndex.path,
          name: fileIndex.name,
          isDirectory: fileIndex.isDirectory,
          color: fileIndex.color,
        })
        .from(fileIndex)
        .innerJoin(connections, eq(fileIndex.connectionId, connections.id))
        .where(and(...conditions))
        .orderBy(
          asc(fileIndex.connectionId),
          asc(fileIndex.name),
          asc(fileIndex.path),
        )
        .limit(pageSize)

      const permissionCache = new Map<
        string,
        Awaited<ReturnType<typeof getPermissionContext>>
      >()
      const grantedPathsCache = new Map<string, string[]>()

      const items: z.infer<typeof fileSearchResultItemSchema>[] = []

      for (const row of rows) {
        let permissionContext = permissionCache.get(row.connectionId)
        if (permissionContext === undefined) {
          permissionContext = await getPermissionContext(
            ctx.sessionData.user.id,
            ctx.organizationId,
            row.connectionId,
          )
          permissionCache.set(row.connectionId, permissionContext)
        }

        if (!permissionContext) {
          continue
        }

        let grantedFolderPaths = grantedPathsCache.get(row.connectionId)
        if (!grantedFolderPaths) {
          grantedFolderPaths = getExplorerGrantedFolderPaths(permissionContext)
          grantedPathsCache.set(row.connectionId, grantedFolderPaths)
        }

        const access = resolvePermissionFromContext(row.path, permissionContext)

        if (
          !isExplorerIndexedEntryVisible(
            permissionContext,
            grantedFolderPaths,
            {
              path: row.path,
              isDirectory: row.isDirectory,
              access,
            },
          )
        ) {
          continue
        }

        items.push({
          connectionId: row.connectionId,
          connectionName: row.connectionName,
          path: row.path,
          name: row.name,
          isDirectory: row.isDirectory,
          color: row.color,
        })
      }

      const hasMore = rows.length === pageSize
      const lastRow = rows[rows.length - 1]
      const nextCursor =
        hasMore && lastRow
          ? {
              connectionId: lastRow.connectionId,
              name: lastRow.name,
              path: lastRow.path,
            }
          : null

      return { items, hasMore, nextCursor }
    }),

  stat: organizationProcedure
    .input(
      z.object({
        connectionId: z.string().min(1),
        path: z.string(),
      }),
    )
    .output(fileEntrySchema)
    .query(async ({ ctx, input }) => {
      const path = safeNormalize(input.path)
      await requireReadPermission(
        ctx.sessionData.user.id,
        ctx.organizationId,
        input.connectionId,
        path,
      )
      const provider = await resolveProvider(
        input.connectionId,
        ctx.organizationId,
      )
      const entry = await provider.stat(path)
      return {
        ...entry,
        color: null,
        icon: null,
      }
    }),

  mkdir: organizationProcedure
    .input(
      z.object({
        connectionId: z.string().min(1),
        path: z.string(),
        color: colorKeySchema.nullable().optional(),
        icon: iconValueSchema.nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const path = safeNormalize(input.path)
      await requireWritePermission(
        ctx.sessionData.user.id,
        ctx.organizationId,
        input.connectionId,
        path,
      )
      const provider = await resolveProvider(
        input.connectionId,
        ctx.organizationId,
      )
      await provider.mkdir(path)
      await indexInsertEntry(input.connectionId, {
        name: pathName(path),
        path,
        isDirectory: true,
        size: null,
        mimeType: null,
        lastModified: new Date(),
      })

      if (input.color !== undefined || input.icon !== undefined) {
        await db
          .update(fileIndex)
          .set({
            ...(input.color !== undefined ? { color: input.color } : {}),
            ...(input.icon !== undefined ? { icon: input.icon } : {}),
          })
          .where(
            and(
              eq(fileIndex.connectionId, input.connectionId),
              eq(fileIndex.path, path),
            ),
          )
      }
    }),

  updateMeta: organizationProcedure
    .input(
      z.object({
        connectionId: z.string().min(1),
        path: z.string(),
        color: colorKeySchema.nullable().optional(),
        icon: iconValueSchema.nullable().optional(),
      }),
    )
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const path = safeNormalize(input.path)
      await requireWritePermission(
        ctx.sessionData.user.id,
        ctx.organizationId,
        input.connectionId,
        path,
      )

      const updates: Partial<typeof fileIndex.$inferInsert> = {}
      if (input.color !== undefined) {
        updates.color = input.color
      }
      if (input.icon !== undefined) {
        updates.icon = input.icon
      }

      if (Object.keys(updates).length === 0) {
        return { ok: true as const }
      }

      await db
        .update(fileIndex)
        .set(updates)
        .where(
          and(
            eq(fileIndex.connectionId, input.connectionId),
            eq(fileIndex.path, path),
          ),
        )

      return { ok: true as const }
    }),

  delete: organizationProcedure
    .input(
      z.object({
        connectionId: z.string().min(1),
        path: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const path = safeNormalize(input.path)
      await requireWritePermission(
        ctx.sessionData.user.id,
        ctx.organizationId,
        input.connectionId,
        path,
      )
      const provider = await resolveProvider(
        input.connectionId,
        ctx.organizationId,
      )
      await provider.delete(path)
      await deleteScopedPermissions(input.connectionId, path)
      await indexDeleteEntry(input.connectionId, path)
    }),

  rename: organizationProcedure
    .input(
      z.object({
        connectionId: z.string().min(1),
        oldPath: z.string(),
        newPath: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const oldPath = safeNormalize(input.oldPath)
      const newPath = safeNormalize(input.newPath)
      await requireWritePermission(
        ctx.sessionData.user.id,
        ctx.organizationId,
        input.connectionId,
        oldPath,
      )
      await requireWritePermission(
        ctx.sessionData.user.id,
        ctx.organizationId,
        input.connectionId,
        newPath,
      )
      const provider = await resolveProvider(
        input.connectionId,
        ctx.organizationId,
      )
      await provider.rename(oldPath, newPath)
      await renameScopedPermissions(input.connectionId, oldPath, newPath)
      await indexRenameEntry(input.connectionId, oldPath, newPath)
    }),
})
