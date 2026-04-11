import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { admin, organization } from 'better-auth/plugins'

import { db } from '../db/index.ts'

export const auth = betterAuth({
  experimental: { joins: true },
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [admin(), organization(), tanstackStartCookies()],
})
