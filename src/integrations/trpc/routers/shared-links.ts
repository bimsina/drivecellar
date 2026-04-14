import { TRPCError } from '@trpc/server'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod/v4'

import { db } from '#/db/index.ts'
import { sharedLinks } from '#/db/schema/index.ts'
import { getConnectionByIdForOrganization } from '#/lib/connection-repository.ts'
import { permissionAccessSchema } from '#/lib/connections.ts'
import {
  assertNormalizedPermissionPath,
  canRead,
  resolvePermission,
} from '#/lib/permissions.ts'
import {
  generateShareToken,
  getSharedLinkById,
  hashSharedLinkPassword,
  resolveSharedLinkAccess,
  toShareRelativePath,
} from '#/lib/shared-links.ts'

import { adminProcedure, createTRPCRouter, publicProcedure } from '../init'

const adminConnectionSchema = z.object({
  connectionId: z.string().min(1),
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

const sharedLinkOutputSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  organizationId: z.string(),
  path: z.string(),
  token: z.string(),
  isDirectory: z.boolean(),
  hasPassword: z.boolean(),
  expiresAt: z.date().nullable(),
  enabled: z.boolean(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  url: z.string(),
})

export const sharedLinksRouter = createTRPCRouter({
  list: adminProcedure
    .input(adminConnectionSchema)
    .output(z.array(sharedLinkOutputSchema))
    .query(async ({ ctx, input }) => {
      await ensureConnectionInOrg(input.connectionId, ctx.organizationId)

      const rows = await db
        .select()
        .from(sharedLinks)
        .where(
          and(
            eq(sharedLinks.connectionId, input.connectionId),
            eq(sharedLinks.organizationId, ctx.organizationId),
          ),
        )
        .orderBy(desc(sharedLinks.updatedAt))

      return rows.map((row) => ({
        ...row,
        hasPassword: Boolean(row.passwordHash),
        expiresAt: row.expiresAt ?? null,
        url: `/s/${row.token}`,
      }))
    }),

  create: adminProcedure
    .input(
      adminConnectionSchema.extend({
        path: z.string().min(1),
        isDirectory: z.boolean(),
        password: z.string().trim().min(1).optional(),
        expiresAt: z.date().nullable().optional(),
      }),
    )
    .output(sharedLinkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await ensureConnectionInOrg(
        input.connectionId,
        ctx.organizationId,
      )
      const normalizedPath = assertNormalizedPermissionPath(input.path)

      const access = await resolvePermission(
        ctx.sessionData.user.id,
        ctx.organizationId,
        input.connectionId,
        normalizedPath,
      )

      if (!canRead(access)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot share a path you cannot read.',
        })
      }

      const id = crypto.randomUUID()
      const token = generateShareToken()
      const passwordHash = input.password
        ? hashSharedLinkPassword(input.password)
        : null

      await db.insert(sharedLinks).values({
        id,
        connectionId: connection.id,
        organizationId: ctx.organizationId,
        path: normalizedPath,
        token,
        isDirectory: input.isDirectory,
        passwordHash,
        expiresAt: input.expiresAt ?? null,
        enabled: true,
        createdBy: ctx.sessionData.user.id,
      })

      const row = await getSharedLinkById(id, ctx.organizationId)

      if (!row) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create shared link.',
        })
      }

      return {
        ...row,
        hasPassword: Boolean(row.passwordHash),
        expiresAt: row.expiresAt ?? null,
        url: `/s/${row.token}`,
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        enabled: z.boolean().optional(),
        expiresAt: z.date().nullable().optional(),
        password: z.string().trim().min(1).optional(),
        clearPassword: z.boolean().optional(),
      }),
    )
    .output(sharedLinkOutputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await getSharedLinkById(input.id, ctx.organizationId)

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shared link not found.',
        })
      }

      await db
        .update(sharedLinks)
        .set({
          enabled: input.enabled ?? existing.enabled,
          expiresAt:
            input.expiresAt === undefined
              ? existing.expiresAt
              : input.expiresAt,
          passwordHash: input.clearPassword
            ? null
            : input.password
              ? hashSharedLinkPassword(input.password)
              : existing.passwordHash,
        })
        .where(eq(sharedLinks.id, input.id))

      const row = await getSharedLinkById(input.id, ctx.organizationId)

      if (!row) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update shared link.',
        })
      }

      return {
        ...row,
        hasPassword: Boolean(row.passwordHash),
        expiresAt: row.expiresAt ?? null,
        url: `/s/${row.token}`,
      }
    }),

  remove: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await getSharedLinkById(input.id, ctx.organizationId)

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shared link not found.',
        })
      }

      await db.delete(sharedLinks).where(eq(sharedLinks.id, input.id))
      return { ok: true as const }
    }),

  resolvePublic: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        password: z.string().optional(),
        path: z.string().default('/'),
      }),
    )
    .query(async ({ input }) => {
      try {
        const resolved = await resolveSharedLinkAccess({
          token: input.token,
          password: input.password,
          relativePath: input.path,
        })
        const entry = await resolved.provider.stat(resolved.absolutePath)
        const entries = entry.isDirectory
          ? (await resolved.provider.list(resolved.absolutePath)).entries.map(
              (child) => ({
                ...child,
                path: toShareRelativePath(resolved.sharedLink.path, child.path),
              }),
            )
          : []

        return {
          token: input.token,
          isDirectory: entry.isDirectory,
          shareRootPath: '/',
          currentPath: resolved.relativePath,
          entry: {
            ...entry,
            path: toShareRelativePath(resolved.sharedLink.path, entry.path),
          },
          entries,
          requiresPassword: Boolean(resolved.sharedLink.passwordHash),
          expiresAt: resolved.sharedLink.expiresAt ?? null,
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not resolve shared link.'

        if (
          message === 'Password required.' ||
          message === 'Invalid password.'
        ) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message,
          })
        }

        throw new TRPCError({
          code: 'NOT_FOUND',
          message,
        })
      }
    }),
})
