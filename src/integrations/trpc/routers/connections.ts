import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

import {
  createConnectionRow,
  deleteConnectionRow,
  getConnectionByIdForOrganization,
  listConnectionsForOrganization,
  updateConnectionRow,
} from '#/lib/connection-repository.ts'
import type { ConnectionRow } from '#/lib/connection-repository.ts'
import {
  connectionListItemSchema,
  createConnectionInputSchema,
  deleteConnectionInputSchema,
  getConnectionInputSchema,
  listConnectionsInputSchema,
  parseConnectionConfig,
  serializeConnectionConfig,
  updateConnectionInputSchema,
} from '#/lib/connections.ts'
import type {
  ClientConnectionConfig,
  ConnectionConfig,
  UpdateConnectionConfig,
} from '#/lib/connections.ts'

import { createTRPCRouter, organizationProcedure } from '../init'

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

export const connectionsRouter = createTRPCRouter({
  list: organizationProcedure
    .input(listConnectionsInputSchema)
    .output(z.array(connectionListItemSchema))
    .query(async ({ ctx, input }) => {
      if (input.organizationId !== ctx.organizationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Active organization does not match the requested query.',
        })
      }

      const rows = await listConnectionsForOrganization(ctx.organizationId)
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

      return toClientConnection(connection)
    }),

  create: organizationProcedure
    .input(createConnectionInputSchema)
    .output(connectionListItemSchema)
    .mutation(async ({ ctx, input }) => {
      const connection = await createConnectionRow({
        id: crypto.randomUUID(),
        name: input.name.trim(),
        description: normalizeOptionalText(input.description),
        type: input.config.type,
        organizationId: ctx.organizationId,
        config: serializeConnectionConfig(input.config),
        createdBy: ctx.sessionData.user.id,
      })

      if (!connection) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create connection.',
        })
      }

      return toClientConnection(connection)
    }),

  update: organizationProcedure
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

      const updatedConnection = await updateConnectionRow(
        input.id,
        ctx.organizationId,
        {
          name: input.name.trim(),
          description: normalizeOptionalText(input.description),
          type: mergedConfig.type,
          config: serializeConnectionConfig(mergedConfig),
        },
      )

      if (!updatedConnection) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update connection.',
        })
      }

      return toClientConnection(updatedConnection)
    }),

  remove: organizationProcedure
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

      return { id: input.id }
    }),
})

export { mergeConnectionConfig, sanitizeConnectionConfig, toClientConnection }
