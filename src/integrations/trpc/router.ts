import { createTRPCRouter } from './init'
import { connectionsRouter } from './routers/connections'
import { filesRouter } from './routers/files'
import { permissionsRouter } from './routers/permissions'
import { sharedLinksRouter } from './routers/shared-links'

export const trpcRouter = createTRPCRouter({
  connections: connectionsRouter,
  files: filesRouter,
  permissions: permissionsRouter,
  sharedLinks: sharedLinksRouter,
})
export type TRPCRouter = typeof trpcRouter
