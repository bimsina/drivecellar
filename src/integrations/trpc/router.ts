import { createTRPCRouter } from './init'
import { connectionsRouter } from './routers/connections'
import { filesRouter } from './routers/files'
import { indexingRouter } from './routers/indexing'
import { permissionsRouter } from './routers/permissions'
import { sharedLinksRouter } from './routers/shared-links'
import { tagsRouter } from './routers/tags'

export const trpcRouter = createTRPCRouter({
  connections: connectionsRouter,
  files: filesRouter,
  indexing: indexingRouter,
  permissions: permissionsRouter,
  sharedLinks: sharedLinksRouter,
  tags: tagsRouter,
})
export type TRPCRouter = typeof trpcRouter
