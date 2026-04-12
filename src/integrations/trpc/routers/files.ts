import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

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

const listResultSchema = z.object({
  path: z.string(),
  entries: z.array(fileEntrySchema),
})

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
      const provider = await resolveProvider(
        input.connectionId,
        ctx.organizationId,
      )
      const path = safeNormalize(input.path)
      return provider.list(path)
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
      const provider = await resolveProvider(
        input.connectionId,
        ctx.organizationId,
      )
      const path = safeNormalize(input.path)
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
      const provider = await resolveProvider(
        input.connectionId,
        ctx.organizationId,
      )
      const path = safeNormalize(input.path)
      await provider.mkdir(path)
    }),

  delete: organizationProcedure
    .input(
      z.object({
        connectionId: z.string().min(1),
        path: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await resolveProvider(
        input.connectionId,
        ctx.organizationId,
      )
      const path = safeNormalize(input.path)
      await provider.delete(path)
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
      const provider = await resolveProvider(
        input.connectionId,
        ctx.organizationId,
      )
      await provider.rename(
        safeNormalize(input.oldPath),
        safeNormalize(input.newPath),
      )
    }),
})
