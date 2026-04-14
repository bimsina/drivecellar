import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

import {
  canRead,
  canWrite,
  deleteScopedPermissions,
  getPermissionContext,
  isOrganizationAdminRole,
  renameScopedPermissions,
  resolvePermissionFromContext,
  resolvePermission,
} from '#/lib/permissions.ts'
import { permissionAccessSchema } from '#/lib/connections.ts'
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
      const grantedFolderPaths = permissionContext.folderAccesses
        .filter((entry) => entry.access !== 'none')
        .map((entry) => normalizePath(entry.path))
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

      const canSeeDirectoryByDescendantAccess = (directoryPath: string) =>
        grantedFolderPaths.some(
          (grantedPath) =>
            grantedPath.startsWith(`${directoryPath}/`) ||
            grantedPath === directoryPath,
        )

      const isVisibleEntry = (entry: {
        isDirectory: boolean
        access: (typeof permissionAccessSchema)['_output']
        path: string
      }) => {
        if (canRead(entry.access)) {
          return true
        }

        if (!entry.isDirectory) {
          return false
        }

        return canSeeDirectoryByDescendantAccess(entry.path)
      }

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
      return provider.stat(path)
    }),

  mkdir: organizationProcedure
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
      await provider.mkdir(path)
      await indexInsertEntry(input.connectionId, {
        name: pathName(path),
        path,
        isDirectory: true,
        size: null,
        mimeType: null,
        lastModified: new Date(),
      })
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
