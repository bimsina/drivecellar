import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

import {
  listVisibleConnectionsForUser,
  createConnectionRow,
  deleteConnectionRow,
  getConnectionByIdForOrganization,
  listConnectionsForOrganization,
  updateConnectionRow,
} from '#/lib/connection-repository.ts'
import { clearCachedProvider } from '#/lib/storage/index.ts'
import {
  ensureLocalPath,
  testConnectionConfig,
} from '#/lib/storage/test-connection.ts'
import type { ConnectionRow } from '#/lib/connection-repository.ts'
import {
  cancelRunningIndexJob,
  clearConnectionIndex,
  startIndexJob,
} from '#/lib/indexing/index.ts'
import {
  parseConnectionConfig,
  serializeConnectionConfig,
} from '#/lib/connection-config-storage.ts'
import {
  connectionListItemSchema,
  createConnectionInputSchema,
  deleteConnectionInputSchema,
  ensureLocalPathInputSchema,
  getConnectionInputSchema,
  listConnectionsInputSchema,
  testConnectionConfigInputSchema,
  testConnectionConfigResultSchema,
  updateConnectionInputSchema,
} from '#/lib/connections.ts'
import type {
  ClientConnectionConfig,
  ConnectionConfig,
  UpdateConnectionConfig,
} from '#/lib/connections.ts'
import {
  canAccessConnection,
  isOrganizationAdminRole,
} from '#/lib/permissions.ts'

import {
  adminProcedure,
  createTRPCRouter,
  organizationProcedure,
} from '../init'

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() ? value.trim() : null
}

function sanitizeConnectionConfig(
  config: ConnectionConfig,
): ClientConnectionConfig {
  if (config.type === 's3') {
    const { secretAccessKey, ...rest } = config

    return {
      ...rest,
      hasSecretAccessKey: Boolean(secretAccessKey),
    }
  }

  return config
}

function toClientConnection(connection: ConnectionRow) {
  return connectionListItemSchema.parse({
    ...connection,
    config: sanitizeConnectionConfig(parseConnectionConfig(connection.config)),
  })
}

function mergeConnectionConfig(
  existingConfig: ConnectionConfig,
  nextConfig: UpdateConnectionConfig,
) {
  if (nextConfig.type !== 's3') {
    return nextConfig
  }

  if (existingConfig.type !== 's3') {
    return {
      ...nextConfig,
      secretAccessKey: nextConfig.secretAccessKey?.trim() || '',
    }
  }

  return {
    ...nextConfig,
    secretAccessKey:
      nextConfig.secretAccessKey?.trim() || existingConfig.secretAccessKey,
  }
}

const organizationRoleSchema = z.enum(['owner', 'admin', 'member'])
const myOrganizationRoleResultSchema = z.object({
  role: organizationRoleSchema,
  canManageConnections: z.boolean(),
})

export const connectionsRouter = createTRPCRouter({
  getMyOrganizationRole: organizationProcedure
    .input(listConnectionsInputSchema)
    .output(myOrganizationRoleResultSchema)
    .query(({ ctx, input }) => {
      if (input.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Active team does not match the requested query.',
        })
      }

      return {
        role: ctx.organizationRole,
        canManageConnections: isOrganizationAdminRole(ctx.organizationRole),
      }
    }),

  list: organizationProcedure
    .input(listConnectionsInputSchema)
    .output(z.array(connectionListItemSchema))
    .query(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Active team does not match the requested query.',
        })
      }

      const rows = isOrganizationAdminRole(ctx.organizationRole)
        ? await listConnectionsForOrganization(ctx.organizationId)
        : await listVisibleConnectionsForUser(
            ctx.organizationId,
            ctx.sessionData.user.id,
          )
      return rows.map(toClientConnection)
    }),

  getById: organizationProcedure
    .input(getConnectionInputSchema)
    .output(connectionListItemSchema)
    .query(async ({ ctx, input }) => {
      const connection = await getConnectionByIdForOrganization(
        input.id,
        ctx.organizationId,
      )

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        })
      }

      if (
        !isOrganizationAdminRole(ctx.organizationRole) &&
        !(await canAccessConnection(
          ctx.sessionData.user.id,
          ctx.organizationId,
          input.id,
        ))
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        })
      }

      return toClientConnection(connection)
    }),

  testConfig: adminProcedure
    .input(testConnectionConfigInputSchema)
    .output(testConnectionConfigResultSchema)
    .mutation(async ({ input }) => {
      try {
        return await testConnectionConfig(input.config)
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not verify this storage connection.'
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        })
      }
    }),

  ensureLocalPath: adminProcedure
    .input(ensureLocalPathInputSchema)
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ input }) => {
      try {
        await ensureLocalPath(input.basePath)
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not create this local folder.'
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        })
      }

      return { ok: true as const }
    }),

  create: adminProcedure
    .input(createConnectionInputSchema)
    .output(connectionListItemSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await createConnectionRow({
        id: crypto.randomUUID(),
        name: input.name.trim(),
        description: normalizeOptionalText(input.description),
        type: input.config.type,
        defaultAccess: input.defaultAccess,
        organizationId: ctx.organizationId,
        config: serializeConnectionConfig(input.config),
        color: input.color ?? null,
        icon: input.icon ?? null,
        createdBy: ctx.sessionData.user.id,
      })

      if (!connection) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create connection.',
        })
      }

      await startIndexJob(connection.id, ctx.organizationId, {
        trigger: 'auto',
        triggeredByUserId: ctx.sessionData.user.id,
      })

      return toClientConnection(connection)
    }),

  update: adminProcedure
    .input(updateConnectionInputSchema)
    .output(connectionListItemSchema)
    .mutation(async ({ ctx, input }) => {
      const existingConnection = await getConnectionByIdForOrganization(
        input.id,
        ctx.organizationId,
      )

      if (!existingConnection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        })
      }

      const mergedConfig = mergeConnectionConfig(
        parseConnectionConfig(existingConnection.config),
        input.config,
      )
      const serializedConfig = serializeConnectionConfig(mergedConfig)
      const hasConfigChanged = existingConnection.config !== serializedConfig

      const updatedConnection = await updateConnectionRow(
        input.id,
        ctx.organizationId,
        {
          name: input.name.trim(),
          description: normalizeOptionalText(input.description),
          type: mergedConfig.type,
          defaultAccess: input.defaultAccess,
          config: serializedConfig,
          color: input.color ?? null,
          icon: input.icon ?? null,
        },
      )

      if (!updatedConnection) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update connection.',
        })
      }

      clearCachedProvider(input.id)

      if (hasConfigChanged) {
        cancelRunningIndexJob(input.id)
        await clearConnectionIndex(input.id)
      }

      return toClientConnection(updatedConnection)
    }),

  remove: adminProcedure
    .input(deleteConnectionInputSchema)
    .output(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteConnectionRow(input.id, ctx.organizationId)

      if (!deleted) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found.',
        })
      }

      clearCachedProvider(input.id)

      return { id: input.id }
    }),
})

export { mergeConnectionConfig, sanitizeConnectionConfig, toClientConnection }
