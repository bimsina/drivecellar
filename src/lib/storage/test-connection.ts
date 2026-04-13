import type { ConnectionConfig } from '#/lib/connections.ts'

import { createStorageProvider } from './registry.ts'

/**
 * Verifies credentials and that the configured root is reachable by listing "/".
 */
export async function testConnectionConfig(
  config: ConnectionConfig,
): Promise<void> {
  await createStorageProvider(config).list('/')
}
