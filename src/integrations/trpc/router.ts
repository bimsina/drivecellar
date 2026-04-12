import { createTRPCRouter } from './init'
import { connectionsRouter } from './routers/connections'
import { filesRouter } from './routers/files'

export const trpcRouter = createTRPCRouter({
  connections: connectionsRouter,
  files: filesRouter,
})
export type TRPCRouter = typeof trpcRouter
