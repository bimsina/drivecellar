import { config } from 'dotenv'
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

config({ path: ['.env.local', '.env'] })

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    CONNECTION_ENCRYPTION_KEY: z.string().min(32),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    CONNECTION_ENCRYPTION_KEY: process.env.CONNECTION_ENCRYPTION_KEY,
  },
  emptyStringAsUndefined: true,
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === 'lint',
})
