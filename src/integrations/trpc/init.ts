import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'

import {
  getOrganizationRole,
  isOrganizationAdminRole,
} from '#/lib/permissions.ts'

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

export const orgRoleProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const organizationId = ctx.sessionData.session.activeOrganizationId

    if (!organizationId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Select an active team to manage connections.',
      })
    }

    const organizationRole = await getOrganizationRole(
      ctx.sessionData.user.id,
      organizationId,
    )

    if (!organizationRole) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of the active team.',
      })
    }

    return next({
      ctx: {
        ...ctx,
        organizationId,
        organizationRole,
      },
    })
  },
)

export const organizationProcedure = orgRoleProcedure

export const adminProcedure = orgRoleProcedure.use(({ ctx, next }) => {
  if (!isOrganizationAdminRole(ctx.organizationRole)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only team owners and admins can manage permissions here.',
    })
  }

  return next()
})
