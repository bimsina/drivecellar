import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'

import type { TRPCContext } from './context'

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.sessionData?.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({
    ctx: {
      ...ctx,
      sessionData: ctx.sessionData,
    },
  })
})

export const organizationProcedure = protectedProcedure.use(({ ctx, next }) => {
  const organizationId = ctx.sessionData.session.activeOrganizationId

  if (!organizationId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Select an active team to manage connections.',
    })
  }

  return next({
    ctx: {
      ...ctx,
      organizationId,
    },
  })
})
