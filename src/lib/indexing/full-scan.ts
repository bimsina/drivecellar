import { and, eq, lt } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { fileIndex, indexRuns, indexStatus } from '#/db/schema/index.ts'
import { parseConnectionConfig } from '#/lib/connection-config-storage.ts'
import { getConnectionByIdForOrganization } from '#/lib/connection-repository.ts'
import { computeParentPath, normalizePath } from '#/lib/storage/path-utils.ts'
import { createStorageProvider } from '#/lib/storage/registry.ts'

import {
  cancelIndexJob,
  clearIndexJob,
  getIndexJob,
  setIndexJob,
} from './job-store.ts'
import { upsertIndexRows } from './inline-updates.ts'
import type {
  IndexJobState,
  IndexRunStatusValue,
  IndexRunTrigger,
  IndexScanCounts,
  IndexedEntry,
} from './types.ts'

type StartIndexJobOptions = {
  trigger?: IndexRunTrigger
  triggeredByUserId?: string | null
}

const BATCH_SIZE = 500

function logIndexingInfo(event: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`[indexing] ${event}`, details)
    return
  }
  console.info(`[indexing] ${event}`)
}

function logIndexingWarn(event: string, details?: Record<string, unknown>) {
  if (details) {
    console.warn(`[indexing] ${event}`, details)
    return
  }
  console.warn(`[indexing] ${event}`)
}

function logIndexingError(event: string, details?: Record<string, unknown>) {
  if (details) {
    console.error(`[indexing] ${event}`, details)
    return
  }
  console.error(`[indexing] ${event}`)
}

function pathName(pathValue: string) {
  return pathValue.split('/').filter(Boolean).at(-1) ?? ''
}

function buildAncestorDirectories(pathValue: string) {
  const segments = pathValue.split('/').filter(Boolean)
  const paths: string[] = []

  for (let i = 1; i < segments.length; i += 1) {
    paths.push(`/${segments.slice(0, i).join('/')}`)
  }

  return paths
}

async function setIndexedCount(connectionId: string, indexedCount: number) {
  await db
    .update(indexStatus)
    .set({
      indexedCount,
      updatedAt: new Date(),
    })
    .where(eq(indexStatus.connectionId, connectionId))
}

async function setIndexingCanceled(
  connectionId: string,
  counts: IndexScanCounts,
  message: string,
  finishedAt: Date,
) {
  await db
    .update(indexStatus)
    .set({
      status: 'idle',
      totalFiles: counts.totalFiles,
      totalFolders: counts.totalFolders,
      totalSize: counts.totalSize,
      indexedCount: counts.indexedCount,
      errorMessage: message,
      updatedAt: finishedAt,
    })
    .where(eq(indexStatus.connectionId, connectionId))
}

async function setIndexingFailed(
  connectionId: string,
  counts: IndexScanCounts,
  message: string,
  finishedAt: Date,
) {
  await db
    .update(indexStatus)
    .set({
      status: 'failed',
      totalFiles: counts.totalFiles,
      totalFolders: counts.totalFolders,
      totalSize: counts.totalSize,
      indexedCount: counts.indexedCount,
      errorMessage: message,
      updatedAt: finishedAt,
    })
    .where(eq(indexStatus.connectionId, connectionId))
}

async function setIndexingComplete(
  connectionId: string,
  counts: IndexScanCounts,
  finishedAt: Date,
) {
  await db
    .update(indexStatus)
    .set({
      status: 'idle',
      lastIndexedAt: finishedAt,
      totalFiles: counts.totalFiles,
      totalFolders: counts.totalFolders,
      totalSize: counts.totalSize,
      indexedCount: counts.indexedCount,
      errorMessage: null,
      updatedAt: finishedAt,
    })
    .where(eq(indexStatus.connectionId, connectionId))
}

async function finalizeIndexRun(args: {
  runId: string
  status: IndexRunStatusValue
  counts: IndexScanCounts
  finishedAt: Date
  errorMessage?: string | null
}) {
  await db
    .update(indexRuns)
    .set({
      status: args.status,
      finishedAt: args.finishedAt,
      indexedCount: args.counts.indexedCount,
      totalFiles: args.counts.totalFiles,
      totalFolders: args.counts.totalFolders,
      totalSize: args.counts.totalSize,
      errorMessage: args.errorMessage ?? null,
      updatedAt: args.finishedAt,
    })
    .where(eq(indexRuns.id, args.runId))
}

async function runFullScan(job: IndexJobState) {
  logIndexingInfo('run_full_scan_started', {
    jobId: job.jobId,
    runId: job.runId,
    connectionId: job.connectionId,
    organizationId: job.organizationId,
    trigger: job.trigger,
    startedAt: job.startedAt.toISOString(),
  })

  const counts: IndexScanCounts = {
    indexedCount: 0,
    totalFiles: 0,
    totalFolders: 0,
    totalSize: 0,
  }

  const scanStartedAt = new Date()
  let flushCount = 0
  const bufferedRows: Array<{
    path: string
    parentPath: string
    name: string
    isDirectory: boolean
    size: number | null
    mimeType: string | null
    lastModified: Date | null
  }> = []
  const dedupedDirectoryPaths = new Set<string>()

  async function flushBuffer() {
    if (bufferedRows.length === 0) {
      return
    }

    const rows = bufferedRows.splice(0, bufferedRows.length)
    const insertedOrUpdated = await upsertIndexRows(
      job.connectionId,
      rows,
      new Date(),
    )
    flushCount += 1

    counts.indexedCount += insertedOrUpdated
    await setIndexedCount(job.connectionId, counts.indexedCount)

    if (flushCount <= 3 || flushCount % 10 === 0) {
      logIndexingInfo('run_full_scan_batch_flushed', {
        jobId: job.jobId,
        runId: job.runId,
        connectionId: job.connectionId,
        flushCount,
        batchRows: rows.length,
        insertedOrUpdated,
        indexedCount: counts.indexedCount,
        totalFiles: counts.totalFiles,
        totalFolders: counts.totalFolders,
      })
    }
  }

  function queueDirectory(pathValue: string, lastModified: Date | null = null) {
    if (pathValue === '/' || dedupedDirectoryPaths.has(pathValue)) {
      return
    }

    dedupedDirectoryPaths.add(pathValue)
    counts.totalFolders += 1

    bufferedRows.push({
      path: pathValue,
      parentPath: computeParentPath(pathValue),
      name: pathName(pathValue),
      isDirectory: true,
      size: null,
      mimeType: null,
      lastModified,
    })
  }

  async function queueEntry(entry: IndexedEntry) {
    const normalizedPath = normalizePath(entry.path)
    if (normalizedPath === '/') {
      return
    }

    for (const ancestorPath of buildAncestorDirectories(normalizedPath)) {
      queueDirectory(ancestorPath)
    }

    if (entry.isDirectory) {
      queueDirectory(normalizedPath, entry.lastModified)
    } else {
      counts.totalFiles += 1
      counts.totalSize += entry.size ?? 0

      bufferedRows.push({
        path: normalizedPath,
        parentPath: computeParentPath(normalizedPath),
        name: entry.name.trim() || pathName(normalizedPath),
        isDirectory: false,
        size: entry.size,
        mimeType: entry.mimeType,
        lastModified: entry.lastModified,
      })
    }

    if (bufferedRows.length >= BATCH_SIZE) {
      await flushBuffer()
    }
  }

  try {
    const connection = await getConnectionByIdForOrganization(
      job.connectionId,
      job.organizationId,
    )

    if (!connection) {
      throw new Error('Connection not found.')
    }

    const config = parseConnectionConfig(connection.config)
    logIndexingInfo('run_full_scan_connection_resolved', {
      jobId: job.jobId,
      runId: job.runId,
      connectionId: job.connectionId,
      configType: config.type,
    })

    const provider = createStorageProvider(config)
    await provider.walk(job.abortController.signal, queueEntry)

    await flushBuffer()

    await db
      .delete(fileIndex)
      .where(
        and(
          eq(fileIndex.connectionId, job.connectionId),
          lt(fileIndex.indexedAt, scanStartedAt),
        ),
      )

    const finishedAt = new Date()

    await Promise.all([
      setIndexingComplete(job.connectionId, counts, finishedAt),
      finalizeIndexRun({
        runId: job.runId,
        status: 'succeeded',
        counts,
        finishedAt,
      }),
    ])

    logIndexingInfo('run_full_scan_completed', {
      jobId: job.jobId,
      runId: job.runId,
      connectionId: job.connectionId,
      durationMs: finishedAt.getTime() - scanStartedAt.getTime(),
      indexedCount: counts.indexedCount,
      totalFiles: counts.totalFiles,
      totalFolders: counts.totalFolders,
      totalSize: counts.totalSize,
      flushCount,
    })
  } catch (error) {
    const finishedAt = new Date()

    if (job.abortController.signal.aborted) {
      const message = 'Indexing canceled.'

      await Promise.all([
        setIndexingCanceled(job.connectionId, counts, message, finishedAt),
        finalizeIndexRun({
          runId: job.runId,
          status: 'canceled',
          counts,
          finishedAt,
          errorMessage: message,
        }),
      ])

      logIndexingWarn('run_full_scan_canceled', {
        jobId: job.jobId,
        runId: job.runId,
        connectionId: job.connectionId,
        durationMs: finishedAt.getTime() - scanStartedAt.getTime(),
        indexedCount: counts.indexedCount,
        totalFiles: counts.totalFiles,
        totalFolders: counts.totalFolders,
        totalSize: counts.totalSize,
      })
    } else {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Indexing failed.'

      await Promise.all([
        setIndexingFailed(job.connectionId, counts, message, finishedAt),
        finalizeIndexRun({
          runId: job.runId,
          status: 'failed',
          counts,
          finishedAt,
          errorMessage: message,
        }),
      ])

      logIndexingError('run_full_scan_failed', {
        jobId: job.jobId,
        runId: job.runId,
        connectionId: job.connectionId,
        durationMs: finishedAt.getTime() - scanStartedAt.getTime(),
        errorMessage: message,
      })
    }
  } finally {
    clearIndexJob(job.connectionId, job.jobId)
    logIndexingInfo('run_full_scan_finalized', {
      jobId: job.jobId,
      runId: job.runId,
      connectionId: job.connectionId,
    })
  }
}

export async function startIndexJob(
  connectionId: string,
  organizationId: string,
  options?: StartIndexJobOptions,
) {
  logIndexingInfo('start_index_job_requested', {
    connectionId,
    organizationId,
    trigger: options?.trigger ?? 'manual',
    triggeredByUserId: options?.triggeredByUserId ?? null,
  })

  if (getIndexJob(connectionId)) {
    logIndexingWarn('start_index_job_blocked_in_memory', { connectionId })
    throw new Error('Indexing is already running for this connection.')
  }

  const [existingStatus] = await db
    .select({ status: indexStatus.status })
    .from(indexStatus)
    .where(eq(indexStatus.connectionId, connectionId))
    .limit(1)

  if (existingStatus?.status === 'indexing') {
    logIndexingWarn('start_index_job_blocked_status', { connectionId })
    throw new Error('Indexing is already running for this connection.')
  }

  const startedAt = new Date()
  const runId = crypto.randomUUID()
  const trigger = options?.trigger ?? 'manual'

  await db.transaction((tx) => {
    tx.insert(indexRuns)
      .values({
        id: runId,
        connectionId,
        status: 'running',
        trigger,
        triggeredByUserId: options?.triggeredByUserId ?? null,
        startedAt,
        indexedCount: 0,
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0,
        errorMessage: null,
      })
      .run()

    tx.insert(indexStatus)
      .values({
        id: crypto.randomUUID(),
        connectionId,
        status: 'indexing',
        totalFiles: 0,
        totalFolders: 0,
        totalSize: 0,
        indexedCount: 0,
        errorMessage: null,
      })
      .onConflictDoUpdate({
        target: indexStatus.connectionId,
        set: {
          status: 'indexing',
          totalFiles: 0,
          totalFolders: 0,
          totalSize: 0,
          indexedCount: 0,
          errorMessage: null,
          updatedAt: new Date(),
        },
      })
      .run()
  })

  logIndexingInfo('start_index_job_seeded_db_state', {
    connectionId,
    organizationId,
    runId,
    startedAt: startedAt.toISOString(),
  })

  const job: IndexJobState = {
    jobId: crypto.randomUUID(),
    runId,
    connectionId,
    organizationId,
    abortController: new AbortController(),
    trigger,
    triggeredByUserId: options?.triggeredByUserId ?? null,
    startedAt,
  }

  setIndexJob(job)
  logIndexingInfo('start_index_job_registered', {
    connectionId,
    runId,
    jobId: job.jobId,
  })

  void runFullScan(job)
  logIndexingInfo('start_index_job_dispatched', {
    connectionId,
    runId,
    jobId: job.jobId,
  })

  return { jobId: job.jobId, runId }
}

export function cancelRunningIndexJob(connectionId: string) {
  const cancelled = cancelIndexJob(connectionId)
  logIndexingInfo('cancel_index_job_requested', {
    connectionId,
    cancelled,
  })
  return cancelled
}
