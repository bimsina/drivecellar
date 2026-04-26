import type {
  ConnectionConfig,
  TestConnectionConfigResult,
} from '#/lib/connections.ts'

import { isStorageProviderError } from './errors.ts'
import { ensureLocalBasePath } from './local-provider.ts'
import { createStorageProvider } from './registry.ts'

/**
 * Verifies credentials and that the configured root is reachable by listing "/".
 * Missing local roots are returned as a recoverable result for the create-drive UI.
 */
export async function testConnectionConfig(
  config: ConnectionConfig,
): Promise<TestConnectionConfigResult> {
  try {
    await createStorageProvider(config).list('/')
    return { ok: true }
  } catch (error) {
    if (
      config.type === 'local' &&
      isStorageProviderError(error) &&
      error.code === 'not_found'
    ) {
      return {
        ok: false,
        code: 'local_path_not_found',
        message: error.message,
        basePath: config.basePath,
      }
    }

    throw error
  }
}

export async function ensureLocalPath(basePath: string): Promise<void> {
  await ensureLocalBasePath(basePath)
}
