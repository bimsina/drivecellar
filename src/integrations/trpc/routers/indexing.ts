import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

import { getConnectionByIdForOrganization } from '#/lib/connection-repository.ts'
import {
  cancelRunningIndexJob,
  getIndexStatus,
  getIndexedEntryCount,
  listIndexRuns,
  startIndexJob,
} from '#/lib/indexing/index.ts'

import { adminProcedure, createTRPCRouter } from '../init'

const connectionInputSchema = z.object({
  connectionId: z.string().min(1),
})

const indexStatusSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  status: z.enum(['idle', 'indexing', 'failed']),
  lastIndexedAt: z.date().nullable(),
  totalFiles: z.number(),
  totalFolders: z.number(),
  totalSize: z.number(),
  indexedCount: z.number(),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

const indexRunSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  status: z.enum(['running', 'succeeded', 'failed', 'canceled']),
  trigger: z.enum(['manual', 'auto', 'scheduled']),
  triggeredByUserId: z.string().nullable(),
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
  indexedCount: z.number(),
  totalFiles: z.number(),
  totalFolders: z.number(),
  totalSize: z.number(),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

async function requireConnectionInOrganization(
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

export const indexingRouter = createTRPCRouter({
  start: adminProcedure
    .input(connectionInputSchema)
    .output(
      z.object({
        jobId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.info('[indexing] trpc_start_requested', {
        connectionId: input.connectionId,
        organizationId: ctx.organizationId,
        userId: ctx.sessionData.user.id,
      })

      await requireConnectionInOrganization(
        input.connectionId,
        ctx.organizationId,
      )

      const duplicateRunMessage =
        'Indexing is already running for this connection.'

      try {
        const result = await startIndexJob(
          input.connectionId,
          ctx.organizationId,
          {
            trigger: 'manual',
            triggeredByUserId: ctx.sessionData.user.id,
          },
        )

        console.info('[indexing] trpc_start_succeeded', {
          connectionId: input.connectionId,
          organizationId: ctx.organizationId,
          jobId: result.jobId,
        })
        return { jobId: result.jobId }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to start indexing.'

        console.error('[indexing] trpc_start_failed', {
          connectionId: input.connectionId,
          organizationId: ctx.organizationId,
          message,
        })

        if (message === duplicateRunMessage) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: duplicateRunMessage,
          })
        }

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message,
        })
      }
    }),

  cancel: adminProcedure
    .input(connectionInputSchema)
    .output(
      z.object({
        cancelled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireConnectionInOrganization(
        input.connectionId,
        ctx.organizationId,
      )

      return {
        cancelled: cancelRunningIndexJob(input.connectionId),
      }
    }),

  status: adminProcedure
    .input(connectionInputSchema)
    .output(indexStatusSchema.nullable())
    .query(async ({ ctx, input }) => {
      await requireConnectionInOrganization(
        input.connectionId,
        ctx.organizationId,
      )

      const status = await getIndexStatus(input.connectionId)
      console.info('[indexing] trpc_status_loaded', {
        connectionId: input.connectionId,
        organizationId: ctx.organizationId,
        status: status?.status ?? null,
        indexedCount: status?.indexedCount ?? 0,
      })
      return status
    }),

  indexedCount: adminProcedure
    .input(connectionInputSchema)
    .output(
      z.object({
        indexedCount: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireConnectionInOrganization(
        input.connectionId,
        ctx.organizationId,
      )

      const indexedCount = await getIndexedEntryCount(input.connectionId)
      console.info('[indexing] trpc_indexed_count_loaded', {
        connectionId: input.connectionId,
        organizationId: ctx.organizationId,
        indexedCount,
      })

      return { indexedCount }
    }),

  runs: adminProcedure
    .input(
      connectionInputSchema.extend({
        limit: z.number().int().positive().max(200).default(50),
      }),
    )
    .output(z.array(indexRunSchema))
    .query(async ({ ctx, input }) => {
      await requireConnectionInOrganization(
        input.connectionId,
        ctx.organizationId,
      )

      const runs = await listIndexRuns(input.connectionId, input.limit)
      console.info('[indexing] trpc_runs_loaded', {
        connectionId: input.connectionId,
        organizationId: ctx.organizationId,
        limit: input.limit,
        count: runs.length,
      })
      return runs
    }),
})
