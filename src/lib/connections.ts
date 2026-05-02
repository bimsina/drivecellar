import { z } from 'zod/v4'
import { colorKeySchema, iconValueSchema } from './tags.ts'

const trimmedString = z.string().trim()
const optionalTrimmedString = z.string().trim().optional()

export const connectionTypeSchema = z.enum(['s3', 'local'])
export const permissionAccessSchema = z.enum(['editor', 'viewer', 'none'])

export const reindexScheduleSchema = z.enum([
  'every_5_minutes',
  'every_15_minutes',
  'every_30_minutes',
  'every_hour',
  'every_6_hours',
  'every_day',
  'every_week',
])

export type ReindexSchedule = z.infer<typeof reindexScheduleSchema>

export const REINDEX_SCHEDULE_INTERVALS: Record<ReindexSchedule, number> = {
  every_5_minutes: 5 * 60 * 1000,
  every_15_minutes: 15 * 60 * 1000,
  every_30_minutes: 30 * 60 * 1000,
  every_hour: 60 * 60 * 1000,
  every_6_hours: 6 * 60 * 60 * 1000,
  every_day: 24 * 60 * 60 * 1000,
  every_week: 7 * 24 * 60 * 60 * 1000,
}

export const REINDEX_SCHEDULE_LABELS: Record<ReindexSchedule, string> = {
  every_5_minutes: 'Every 5 minutes',
  every_15_minutes: 'Every 15 minutes',
  every_30_minutes: 'Every 30 minutes',
  every_hour: 'Every hour',
  every_6_hours: 'Every 6 hours',
  every_day: 'Every day',
  every_week: 'Every week',
}

export const connectionMetadataSchema = z.object({
  name: trimmedString.min(1, 'Connection name is required.').max(120),
  description: optionalTrimmedString
    .transform((value) => value?.trim() || undefined)
    .pipe(z.string().max(500).optional()),
})

export const s3ConfigSchema = z.object({
  type: z.literal('s3'),
  endpoint: trimmedString.min(1, 'Endpoint is required.'),
  region: optionalTrimmedString,
  bucket: trimmedString.min(1, 'Bucket is required.'),
  accessKeyId: trimmedString.min(1, 'Access key ID is required.'),
  secretAccessKey: trimmedString.min(1, 'Secret access key is required.'),
  pathStyle: z.boolean().default(false),
  prefix: optionalTrimmedString,
})

export const localConfigSchema = z.object({
  type: z.literal('local'),
  basePath: trimmedString.min(1, 'Base path is required.'),
})

export const connectionConfigSchema = z.discriminatedUnion('type', [
  s3ConfigSchema,
  localConfigSchema,
])

export const createConnectionInputSchema = connectionMetadataSchema.extend({
  config: connectionConfigSchema,
  defaultAccess: permissionAccessSchema,
  color: colorKeySchema.nullable().optional(),
  icon: iconValueSchema.nullable().optional(),
  reindexSchedule: reindexScheduleSchema.nullable().optional(),
})

export const updateS3ConfigSchema = s3ConfigSchema.extend({
  secretAccessKey: z.string().trim().optional(),
})

export const updateConnectionConfigSchema = z.discriminatedUnion('type', [
  updateS3ConfigSchema,
  localConfigSchema,
])

export const updateConnectionInputSchema = connectionMetadataSchema.extend({
  id: z.string().min(1),
  config: updateConnectionConfigSchema,
  defaultAccess: permissionAccessSchema,
  color: colorKeySchema.nullable().optional(),
  icon: iconValueSchema.nullable().optional(),
  reindexSchedule: reindexScheduleSchema.nullable().optional(),
})

export const deleteConnectionInputSchema = z.object({
  id: z.string().min(1),
})

export const listConnectionsInputSchema = z.object({
  organizationId: z.string().min(1),
})

export const clientS3ConfigSchema = s3ConfigSchema
  .omit({ secretAccessKey: true })
  .extend({
    hasSecretAccessKey: z.boolean(),
  })

export const clientConnectionConfigSchema = z.discriminatedUnion('type', [
  clientS3ConfigSchema,
  localConfigSchema,
])

export const connectionListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  organizationId: z.string(),
  defaultAccess: permissionAccessSchema,
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  config: clientConnectionConfigSchema,
  color: z.string().nullable(),
  icon: z.string().nullable(),
  reindexSchedule: reindexScheduleSchema.nullable(),
})

export const getConnectionInputSchema = z.object({
  id: z.string().min(1),
})

export const testConnectionConfigInputSchema = z.object({
  config: connectionConfigSchema,
})

export const testConnectionConfigResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
  }),
  z.object({
    ok: z.literal(false),
    code: z.literal('local_path_not_found'),
    message: z.string(),
    basePath: z.string(),
  }),
])

export const ensureLocalPathInputSchema = z.object({
  basePath: trimmedString.min(1, 'Base path is required.'),
})

export type ConnectionMetadataInput = z.infer<typeof connectionMetadataSchema>
export type S3Config = z.infer<typeof s3ConfigSchema>
export type LocalConfig = z.infer<typeof localConfigSchema>
export type ConnectionConfig = z.infer<typeof connectionConfigSchema>
export type CreateConnectionInput = z.infer<typeof createConnectionInputSchema>
export type UpdateS3Config = z.infer<typeof updateS3ConfigSchema>
export type UpdateConnectionConfig = z.infer<
  typeof updateConnectionConfigSchema
>
export type UpdateConnectionInput = z.infer<typeof updateConnectionInputSchema>
export type ListConnectionsInput = z.infer<typeof listConnectionsInputSchema>
export type ClientS3Config = z.infer<typeof clientS3ConfigSchema>
export type ClientConnectionConfig = z.infer<
  typeof clientConnectionConfigSchema
>
export type ConnectionListItem = z.infer<typeof connectionListItemSchema>
export type PermissionAccess = z.infer<typeof permissionAccessSchema>
export type TestConnectionConfigResult = z.infer<
  typeof testConnectionConfigResultSchema
>
