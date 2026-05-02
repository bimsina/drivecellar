import { isNotNull } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { connections } from '#/db/schema/index.ts'
import {
  REINDEX_SCHEDULE_INTERVALS,
  reindexScheduleSchema,
} from '#/lib/connections.ts'

import { startIndexJob } from './full-scan.ts'
import { getIndexJob } from './job-store.ts'
import { getIndexStatus } from './queries.ts'

const POLL_MS = 60_000
const INITIAL_DELAY_MS = 5_000

let intervalId: ReturnType<typeof setInterval> | undefined
let initialTimeoutId: ReturnType<typeof setTimeout> | undefined
let started = false

export function startReindexScheduler() {
  if (started) {
    return
  }
  started = true

  initialTimeoutId = setTimeout(() => {
    initialTimeoutId = undefined
    void checkAndTriggerScheduledJobs()
    intervalId = setInterval(() => {
      void checkAndTriggerScheduledJobs()
    }, POLL_MS)
  }, INITIAL_DELAY_MS)
}

export function stopReindexScheduler() {
  started = false
  if (initialTimeoutId !== undefined) {
    clearTimeout(initialTimeoutId)
    initialTimeoutId = undefined
  }
  if (intervalId !== undefined) {
    clearInterval(intervalId)
    intervalId = undefined
  }
}

export async function checkAndTriggerScheduledJobs() {
  const rows = await db
    .select({
      id: connections.id,
      organizationId: connections.organizationId,
      reindexSchedule: connections.reindexSchedule,
    })
    .from(connections)
    .where(isNotNull(connections.reindexSchedule))

  const now = Date.now()

  for (const row of rows) {
    const parsed = reindexScheduleSchema.safeParse(row.reindexSchedule)
    if (!parsed.success) {
      console.warn('[scheduler] skip_connection_invalid_schedule', {
        connectionId: row.id,
        reindexSchedule: row.reindexSchedule,
      })
      continue
    }

    const schedule = parsed.data

    try {
      if (getIndexJob(row.id)) {
        continue
      }

      const intervalMs = REINDEX_SCHEDULE_INTERVALS[schedule]
      const status = await getIndexStatus(row.id)
      const last = status?.lastIndexedAt?.getTime()

      const due =
        last === undefined || !Number.isFinite(last) || now - last >= intervalMs

      if (!due) {
        continue
      }

      console.info('[scheduler] starting_scheduled_reindex', {
        connectionId: row.id,
        organizationId: row.organizationId,
        schedule,
      })

      await startIndexJob(row.id, row.organizationId, {
        trigger: 'scheduled',
        triggeredByUserId: null,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Scheduled reindex failed.'
      console.error('[scheduler] connection_reindex_failed', {
        connectionId: row.id,
        organizationId: row.organizationId,
        message,
      })
    }
  }
}
