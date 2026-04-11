import { auth } from '#/lib/auth'

export type TRPCContext = {
  sessionData: Awaited<ReturnType<typeof auth.api.getSession>>
}

export async function createTRPCContext(opts: {
  headers: Headers
}): Promise<TRPCContext> {
  const sessionData = await auth.api.getSession({
    headers: opts.headers,
  })
  return { sessionData }
}
