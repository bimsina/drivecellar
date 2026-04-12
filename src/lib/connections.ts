import { z } from 'zod/v4'

const trimmedString = z.string().trim()
const optionalTrimmedString = z.string().trim().optional()

export const connectionTypeSchema = z.enum(['s3', 'local'])

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
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  config: clientConnectionConfigSchema,
})

export const getConnectionInputSchema = z.object({
  id: z.string().min(1),
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

export function serializeConnectionConfig(config: ConnectionConfig): string {
  return JSON.stringify(connectionConfigSchema.parse(config))
}

export function parseConnectionConfig(rawConfig: string): ConnectionConfig {
  const parsed = JSON.parse(rawConfig) as unknown
  return connectionConfigSchema.parse(parsed)
}
