import { z } from 'zod/v4'

import { COLOR_PALETTE } from './color-palette'

const colorKeys = COLOR_PALETTE.map((entry) => entry.key)

export const colorKeySchema = z.enum(colorKeys as [string, ...string[]])
export const iconValueSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*:.+$/)
  .max(200)

const tagNameSchema = z.string().trim().min(1).max(50)

export const tagSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string(),
  color: colorKeySchema,
  createdBy: z.string().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const tagListItemSchema = tagSchema.pick({
  id: true,
  name: true,
  color: true,
})

export const createTagInputSchema = z.object({
  name: tagNameSchema,
  color: colorKeySchema,
})

export const updateTagInputSchema = z.object({
  id: z.string().min(1),
  name: tagNameSchema.optional(),
  color: colorKeySchema.optional(),
})

export const deleteTagInputSchema = z.object({
  id: z.string().min(1),
})

export const assignTagInputSchema = z.object({
  tagId: z.string().min(1),
  connectionId: z.string().min(1),
  path: z.string().min(1),
})

export const removeTagInputSchema = assignTagInputSchema

export const listFileTagsInputSchema = z.object({
  connectionId: z.string().min(1),
  paths: z.array(z.string().min(1)).max(1000),
})

export type ColorKeyInput = z.infer<typeof colorKeySchema>
export type Tag = z.infer<typeof tagSchema>
export type TagListItem = z.infer<typeof tagListItemSchema>
