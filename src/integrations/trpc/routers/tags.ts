import { TRPCError } from '@trpc/server'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod/v4'

import { db } from '#/db/index.ts'
import { fileIndex, fileTags, tags } from '#/db/schema/index.ts'
import {
  canRead,
  canWrite,
  isOrganizationAdminRole,
  resolvePermission,
} from '#/lib/permissions.ts'
import {
  assignTagInputSchema,
  createTagInputSchema,
  deleteTagInputSchema,
  listFileTagsInputSchema,
  removeTagInputSchema,
  tagListItemSchema,
  tagSchema,
  updateTagInputSchema,
} from '#/lib/tags.ts'
import { normalizePath, PathError } from '#/lib/storage/path-utils.ts'

import { createTRPCRouter, organizationProcedure } from '../init'

const listForFilesResultSchema = z.record(
  z.string(),
  z.array(tagListItemSchema),
)

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes('unique constraint failed')
  )
}

function assertPath(path: string) {
  try {
    return normalizePath(path)
  } catch (error) {
    if (error instanceof PathError) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: error.message })
    }
    throw error
  }
}

async function requireTagInOrganization(tagId: string, organizationId: string) {
  const tag = await db.query.tags.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.id, tagId),
        operators.eq(table.organizationId, organizationId),
      ),
  })

  if (!tag) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Tag not found.',
    })
  }

  return tag
}

async function requireFileEntry(connectionId: string, path: string) {
  const fileEntry = await db.query.fileIndex.findFirst({
    where: (table, operators) =>
      operators.and(
        operators.eq(table.connectionId, connectionId),
        operators.eq(table.path, path),
      ),
    columns: {
      id: true,
      path: true,
    },
  })

  if (!fileEntry) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'File or folder not found in index. Re-index and try again.',
    })
  }

  return fileEntry
}

export const tagsRouter = createTRPCRouter({
  list: organizationProcedure.output(z.array(tagSchema)).query(({ ctx }) => {
    return db
      .select()
      .from(tags)
      .where(eq(tags.organizationId, ctx.organizationId))
      .orderBy(asc(tags.name))
  }),

  create: organizationProcedure
    .input(createTagInputSchema)
    .output(tagSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [createdTag] = await db
          .insert(tags)
          .values({
            id: crypto.randomUUID(),
            organizationId: ctx.organizationId,
            name: input.name.trim(),
            color: input.color,
            createdBy: ctx.sessionData.user.id,
          })
          .returning()

        if (!createdTag) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create tag.',
          })
        }

        return createdTag
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              'A tag with this name already exists in this organization.',
          })
        }
        throw error
      }
    }),

  update: organizationProcedure
    .input(updateTagInputSchema)
    .output(tagSchema)
    .mutation(async ({ ctx, input }) => {
      const tag = await requireTagInOrganization(input.id, ctx.organizationId)

      if (
        !isOrganizationAdminRole(ctx.organizationRole) &&
        tag.createdBy !== ctx.sessionData.user.id
      ) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the tag creator or an admin can update this tag.',
        })
      }

      const nextName = input.name?.trim()
      const nextColor = input.color

      if (!nextName && !nextColor) {
        return tag
      }

      try {
        const [updated] = await db
          .update(tags)
          .set({
            ...(nextName ? { name: nextName } : {}),
            ...(nextColor ? { color: nextColor } : {}),
            updatedAt: new Date(),
          })
          .where(eq(tags.id, tag.id))
          .returning()

        if (!updated) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update tag.',
          })
        }

        return updated
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message:
              'A tag with this name already exists in this organization.',
          })
        }
        throw error
      }
    }),

  delete: organizationProcedure
    .input(deleteTagInputSchema)
    .output(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tag = await requireTagInOrganization(input.id, ctx.organizationId)

      if (
        !isOrganizationAdminRole(ctx.organizationRole) &&
        tag.createdBy !== ctx.sessionData.user.id
      ) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the tag creator or an admin can delete this tag.',
        })
      }

      await db.delete(tags).where(eq(tags.id, input.id))
      return { id: input.id }
    }),

  assign: organizationProcedure
    .input(assignTagInputSchema)
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const normalizedPath = assertPath(input.path)
      await requireTagInOrganization(input.tagId, ctx.organizationId)
      const access = await resolvePermission(
        ctx.sessionData.user.id,
        ctx.organizationId,
        input.connectionId,
        normalizedPath,
      )
      if (!canWrite(access)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have write access to this path.',
        })
      }

      const fileEntry = await requireFileEntry(
        input.connectionId,
        normalizedPath,
      )

      await db
        .insert(fileTags)
        .values({
          id: crypto.randomUUID(),
          tagId: input.tagId,
          fileId: fileEntry.id,
          createdBy: ctx.sessionData.user.id,
        })
        .onConflictDoNothing({
          target: [fileTags.tagId, fileTags.fileId],
        })

      return { ok: true as const }
    }),

  remove: organizationProcedure
    .input(removeTagInputSchema)
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const normalizedPath = assertPath(input.path)
      await requireTagInOrganization(input.tagId, ctx.organizationId)
      const access = await resolvePermission(
        ctx.sessionData.user.id,
        ctx.organizationId,
        input.connectionId,
        normalizedPath,
      )
      if (!canWrite(access)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have write access to this path.',
        })
      }

      const fileEntry = await requireFileEntry(
        input.connectionId,
        normalizedPath,
      )

      await db
        .delete(fileTags)
        .where(
          and(
            eq(fileTags.tagId, input.tagId),
            eq(fileTags.fileId, fileEntry.id),
          ),
        )

      return { ok: true as const }
    }),

  listForFiles: organizationProcedure
    .input(listFileTagsInputSchema)
    .output(listForFilesResultSchema)
    .query(async ({ ctx, input }) => {
      const normalizedPaths = Array.from(
        new Set(input.paths.map((entry) => assertPath(entry))),
      )

      if (normalizedPaths.length === 0) {
        return {}
      }

      const readablePaths = (
        await Promise.all(
          normalizedPaths.map(async (path) => {
            const access = await resolvePermission(
              ctx.sessionData.user.id,
              ctx.organizationId,
              input.connectionId,
              path,
            )
            return canRead(access) ? path : null
          }),
        )
      ).filter((entry): entry is string => Boolean(entry))

      if (readablePaths.length === 0) {
        return {}
      }

      const rows = await db
        .select({
          path: fileIndex.path,
          tagId: tags.id,
          tagName: tags.name,
          tagColor: tags.color,
        })
        .from(fileTags)
        .innerJoin(tags, eq(tags.id, fileTags.tagId))
        .innerJoin(fileIndex, eq(fileIndex.id, fileTags.fileId))
        .where(
          and(
            eq(tags.organizationId, ctx.organizationId),
            eq(fileIndex.connectionId, input.connectionId),
            inArray(fileIndex.path, readablePaths),
          ),
        )
        .orderBy(asc(tags.name))

      const byPath: Record<
        string,
        Array<z.infer<typeof tagListItemSchema>>
      > = {}

      for (const row of rows) {
        byPath[row.path] ??= []
        byPath[row.path]?.push({
          id: row.tagId,
          name: row.tagName,
          color: row.tagColor,
        })
      }

      return byPath
    }),
})
