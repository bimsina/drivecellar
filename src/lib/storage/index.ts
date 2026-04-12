import { getConnectionByIdForOrganization } from '#/lib/connection-repository.ts'
import { parseConnectionConfig } from '#/lib/connections.ts'

import {
  createStorageProvider,
  getCachedProvider,
  setCachedProvider,
} from './registry.ts'
import type { StorageProvider } from './types.ts'

export type { FileEntry, ListResult, StorageProvider } from './types.ts'
export { clearCachedProvider } from './registry.ts'

export async function resolveProvider(
  connectionId: string,
  organizationId: string,
): Promise<StorageProvider> {
  const cached = getCachedProvider(connectionId)
  if (cached) {
    return cached
  }

  const row = await getConnectionByIdForOrganization(
    connectionId,
    organizationId,
  )

  if (!row) {
    throw new Error('Connection not found.')
  }

  const config = parseConnectionConfig(row.config)
  const provider = createStorageProvider(config)
  setCachedProvider(connectionId, provider)
  return provider
}
