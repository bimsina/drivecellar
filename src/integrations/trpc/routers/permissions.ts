import { TRPCError } from '@trpc/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod/v4'

import { db } from '#/db/index.ts'
import {
  connectionPermissions,
  folderPermissions,
  users,
} from '#/db/schema/index.ts'
import { getConnectionByIdForOrganization } from '#/lib/connection-repository.ts'
import {
  assertNormalizedPermissionPath,
  getPermissionContext,
  resolvePermission,
} from '#/lib/permissions.ts'
import { permissionAccessSchema } from '#/lib/connections.ts'

import {
  adminProcedure,
  createTRPCRouter,
  organizationProcedure,
} from '../init'

const connectionTargetSchema = z.object({
  connectionId: z.string().min(1),
})

const connectionAccessInputSchema = connectionTargetSchema.extend({
  userId: z.string().min(1),
  access: permissionAccessSchema,
})

const folderAccessInputSchema = connectionAccessInputSchema.extend({
  path: z.string().min(1),
})

async function ensureConnectionInOrg(
  connectionId: string,
  organizationId: string,
) {
  const connection = await getConnectionByIdForOrganization(
    connectionId,
    organizationId,
  )

  if (!connection) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Connection not found.',
    })
  }

  return connection
}

export const permissionsRouter = createTRPCRouter({
  getConnectionAccess: adminProcedure
    .input(connectionTargetSchema)
    .query(async ({ ctx, input }) => {
      const connection = await ensureConnectionInOrg(
        input.connectionId,
        ctx.organizationId,
      )

      const rows = await db
        .select({
          id: connectionPermissions.id,
          userId: connectionPermissions.userId,
          access: connectionPermissions.access,
          name: users.name,
          email: users.email,
          updatedAt: connectionPermissions.updatedAt,
        })
        .from(connectionPermissions)
        .innerJoin(users, eq(users.id, connectionPermissions.userId))
        .where(eq(connectionPermissions.connectionId, input.connectionId))

      return {
        defaultAccess: connection.defaultAccess,
        entries: rows,
      }
    }),

  setConnectionAccess: adminProcedure
    .input(connectionAccessInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ensureConnectionInOrg(input.connectionId, ctx.organizationId)

      await db
        .insert(connectionPermissions)
        .values({
          id: crypto.randomUUID(),
          connectionId: input.connectionId,
          userId: input.userId,
          access: input.access,
        })
        .onConflictDoUpdate({
          target: [
            connectionPermissions.connectionId,
            connectionPermissions.userId,
          ],
          set: {
            access: input.access,
            updatedAt: new Date(),
          },
        })

      return { ok: true as const }
    }),

  removeConnectionAccess: adminProcedure
    .input(
      connectionTargetSchema.extend({
        userId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureConnectionInOrg(input.connectionId, ctx.organizationId)

      await db
        .delete(connectionPermissions)
        .where(
          and(
            eq(connectionPermissions.connectionId, input.connectionId),
            eq(connectionPermissions.userId, input.userId),
          ),
        )

      return { ok: true as const }
    }),

  getFolderAccess: adminProcedure
    .input(
      connectionTargetSchema.extend({
        path: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureConnectionInOrg(input.connectionId, ctx.organizationId)

      const normalizedPath = input.path
        ? assertNormalizedPermissionPath(input.path)
        : undefined

      const rows = await db
        .select({
          id: folderPermissions.id,
          userId: folderPermissions.userId,
          path: folderPermissions.path,
          access: folderPermissions.access,
          name: users.name,
          email: users.email,
          updatedAt: folderPermissions.updatedAt,
        })
        .from(folderPermissions)
        .innerJoin(users, eq(users.id, folderPermissions.userId))
        .where(
          normalizedPath
            ? and(
                eq(folderPermissions.connectionId, input.connectionId),
                eq(folderPermissions.path, normalizedPath),
              )
            : eq(folderPermissions.connectionId, input.connectionId),
        )

      return rows
    }),

  setFolderAccess: adminProcedure
    .input(folderAccessInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ensureConnectionInOrg(input.connectionId, ctx.organizationId)

      const normalizedPath = assertNormalizedPermissionPath(input.path)

      await db
        .insert(folderPermissions)
        .values({
          id: crypto.randomUUID(),
          connectionId: input.connectionId,
          userId: input.userId,
          path: normalizedPath,
          access: input.access,
        })
        .onConflictDoUpdate({
          target: [
            folderPermissions.connectionId,
            folderPermissions.userId,
            folderPermissions.path,
          ],
          set: {
            access: input.access,
            updatedAt: new Date(),
          },
        })

      return { ok: true as const }
    }),

  removeFolderAccess: adminProcedure
    .input(
      connectionTargetSchema.extend({
        userId: z.string().min(1),
        path: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureConnectionInOrg(input.connectionId, ctx.organizationId)
      const normalizedPath = assertNormalizedPermissionPath(input.path)

      await db
        .delete(folderPermissions)
        .where(
          and(
            eq(folderPermissions.connectionId, input.connectionId),
            eq(folderPermissions.userId, input.userId),
            eq(folderPermissions.path, normalizedPath),
          ),
        )

      return { ok: true as const }
    }),

  getMyAccess: organizationProcedure
    .input(
      connectionTargetSchema.extend({
        path: z.string().default('/'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const normalizedPath = assertNormalizedPermissionPath(input.path)
      const context = await getPermissionContext(
        ctx.sessionData.user.id,
        ctx.organizationId,
        input.connectionId,
      )

      if (!context) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        })
      }

      return {
        organizationRole: ctx.organizationRole,
        access: await resolvePermission(
          ctx.sessionData.user.id,
          ctx.organizationId,
          input.connectionId,
          normalizedPath,
        ),
      }
    }),
})
