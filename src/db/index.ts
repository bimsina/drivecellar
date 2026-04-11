import { drizzle } from 'drizzle-orm/better-sqlite3'

import { env } from '#/lib/env'

import * as schema from './schema/index.ts'

export const db = drizzle(env.DATABASE_URL, { schema })
