import type { ConnectionConfig } from '#/lib/connections.ts'

import { createLocalProvider } from './local-provider.ts'
import { createS3Provider } from './s3-provider.ts'
import type { StorageProvider } from './types.ts'

const cache = new Map<string, StorageProvider>()

export function clearCachedProvider(connectionId: string) {
  cache.delete(connectionId)
}

export function createStorageProvider(
  config: ConnectionConfig,
): StorageProvider {
  switch (config.type) {
    case 'local':
      return createLocalProvider(config)
    case 's3':
      return createS3Provider(config)
    default: {
      const _never: never = config
      return _never
    }
  }
}

export function getCachedProvider(
  connectionId: string,
): StorageProvider | undefined {
  return cache.get(connectionId)
}

export function setCachedProvider(
  connectionId: string,
  provider: StorageProvider,
) {
  cache.set(connectionId, provider)
}
