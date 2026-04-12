import { createTRPCRouter } from './init'
import { connectionsRouter } from './routers/connections'

export const trpcRouter = createTRPCRouter({
  connections: connectionsRouter,
})
export type TRPCRouter = typeof trpcRouter
