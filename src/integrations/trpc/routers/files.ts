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
  listFromIndex,
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

const listResultSchema = z.object({
  path: z.string(),
  currentAccess: permissionAccessSchema,
  entries: z.array(fileListEntrySchema),
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
      }),
    )
    .output(listResultSchema)
    .query(async ({ ctx, input }) => {
      const path = safeNormalize(input.path)
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

      const entries = await listFromIndex(input.connectionId, path)

      const entriesWithAccess = entries.map((entry) => ({
        ...entry,
        access: resolvePermissionFromContext(entry.path, permissionContext),
      }))

      return {
        path,
        currentAccess,
        entries: entriesWithAccess.filter((entry) => {
          if (canRead(entry.access)) {
            return true
          }

          if (!entry.isDirectory) {
            return false
          }

          return grantedFolderPaths.some(
            (grantedPath) =>
              grantedPath.startsWith(`${entry.path}/`) ||
              grantedPath === entry.path,
          )
        }),
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
