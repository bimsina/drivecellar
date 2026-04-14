import type { FileEntry } from '#/lib/storage/types.ts'

export type IndexStatusValue = 'idle' | 'indexing' | 'failed'
export type IndexRunStatusValue =
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled'
export type IndexRunTrigger = 'manual' | 'auto'

export type IndexJobState = {
  jobId: string
  runId: string
  connectionId: string
  organizationId: string
  abortController: AbortController
  trigger: IndexRunTrigger
  triggeredByUserId?: string | null
  startedAt: Date
}

export type IndexScanCounts = {
  indexedCount: number
  totalFiles: number
  totalFolders: number
  totalSize: number
}

export type IndexedEntry = Pick<
  FileEntry,
  'name' | 'path' | 'isDirectory' | 'size' | 'mimeType' | 'lastModified'
>
