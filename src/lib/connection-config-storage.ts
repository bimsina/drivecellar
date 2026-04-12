import {
  decryptCredentialValue,
  deriveConnectionEncryptionKey,
  encryptCredentialValue,
  isEncryptedCredential,
} from '#/lib/crypto/connection-credentials.ts'
import {
  connectionConfigSchema,
  type ConnectionConfig,
} from '#/lib/connections.ts'
import { env } from '#/lib/env.ts'

let connectionEncryptionKey: Buffer | null = null

function getConnectionEncryptionKey(): Buffer {
  if (!connectionEncryptionKey) {
    connectionEncryptionKey = deriveConnectionEncryptionKey(
      env.CONNECTION_ENCRYPTION_KEY,
    )
  }
  return connectionEncryptionKey
}

function decryptS3StoredFields(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const key = getConnectionEncryptionKey()
  const out = { ...raw }
  const accessKeyId = out.accessKeyId
  const secretAccessKey = out.secretAccessKey
  if (typeof accessKeyId === 'string' && isEncryptedCredential(accessKeyId)) {
    out.accessKeyId = decryptCredentialValue(accessKeyId, key)
  }
  if (
    typeof secretAccessKey === 'string' &&
    isEncryptedCredential(secretAccessKey)
  ) {
    out.secretAccessKey = decryptCredentialValue(secretAccessKey, key)
  }
  return out
}

export function serializeConnectionConfig(config: ConnectionConfig): string {
  const parsed = connectionConfigSchema.parse(config)
  if (parsed.type === 's3') {
    const key = getConnectionEncryptionKey()
    const stored = {
      ...parsed,
      accessKeyId: encryptCredentialValue(parsed.accessKeyId, key),
      secretAccessKey: encryptCredentialValue(parsed.secretAccessKey, key),
    }
    return JSON.stringify(stored)
  }
  return JSON.stringify(parsed)
}

export function parseConnectionConfig(rawConfig: string): ConnectionConfig {
  const parsed = JSON.parse(rawConfig) as unknown
  if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
    throw new Error('Invalid connection config.')
  }
  const obj = parsed as Record<string, unknown>
  if (obj.type === 's3') {
    const normalized = decryptS3StoredFields(obj)
    return connectionConfigSchema.parse(normalized)
  }
  return connectionConfigSchema.parse(parsed)
}
