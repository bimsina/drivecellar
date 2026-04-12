import { normalizePath } from '#/lib/storage/path-utils'

import type {
  PreparedUploadBatch,
  PreparedUploadDirectory,
  PreparedUploadFile,
  QueuedUpload,
} from './upload-types'

type UploadQueueAction =
  | {
      type: 'enqueue'
      uploads: QueuedUpload[]
    }
  | {
      type: 'start'
      id: string
    }
  | {
      type: 'progress'
      id: string
      progress: number
    }
  | {
      type: 'success'
      id: string
      requestedPath: string
      resolvedPath: string
      renamed: boolean
    }
  | {
      type: 'error'
      id: string
      error: string
    }
  | {
      type: 'dismiss-complete'
    }
  | {
      type: 'remove'
      id: string
    }

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null
}

function getFileRelativePath(file: File) {
  const candidate = (
    file as File & {
      webkitRelativePath?: string
    }
  ).webkitRelativePath

  return candidate?.trim() ? candidate : null
}

function ensureRelativePath(relativePath: string | null | undefined) {
  if (!relativePath) return null

  const normalized = normalizePath(relativePath)
  return normalized === '/' ? null : normalized.slice(1)
}

function createUploadId() {
  return crypto.randomUUID()
}

export function createQueuedUploads(
  files: PreparedUploadFile[],
  targetPath: string,
): QueuedUpload[] {
  return files.map(({ file, relativePath }) => ({
    id: createUploadId(),
    file,
    sourceName: file.name,
    relativePath: ensureRelativePath(relativePath),
    targetPath,
    progress: 0,
    status: 'queued',
    requestedPath: null,
    resolvedPath: null,
    renamed: false,
    error: null,
  }))
}

export function uploadQueueReducer(
  state: QueuedUpload[],
  action: UploadQueueAction,
): QueuedUpload[] {
  switch (action.type) {
    case 'enqueue':
      return [...state, ...action.uploads]

    case 'start':
      return state.map((upload) =>
        upload.id === action.id
          ? {
              ...upload,
              status: 'uploading',
              progress: upload.progress > 0 ? upload.progress : 0,
              error: null,
            }
          : upload,
      )

    case 'progress':
      return state.map((upload) =>
        upload.id === action.id
          ? {
              ...upload,
              progress: Math.min(
                100,
                Math.max(upload.progress, action.progress),
              ),
            }
          : upload,
      )

    case 'success':
      return state.map((upload) =>
        upload.id === action.id
          ? {
              ...upload,
              status: 'success',
              progress: 100,
              requestedPath: action.requestedPath,
              resolvedPath: action.resolvedPath,
              renamed: action.renamed,
              error: null,
            }
          : upload,
      )

    case 'error':
      return state.map((upload) =>
        upload.id === action.id
          ? {
              ...upload,
              status: 'error',
              error: action.error,
            }
          : upload,
      )

    case 'dismiss-complete':
      return state.filter(
        (upload) => upload.status === 'queued' || upload.status === 'uploading',
      )

    case 'remove':
      return state.filter((upload) => upload.id !== action.id)

    default:
      return state
  }
}

export function countActiveUploads(state: QueuedUpload[]) {
  return state.filter((upload) => upload.status === 'uploading').length
}

export function getNextQueuedUploads(state: QueuedUpload[], limit: number) {
  const available = Math.max(0, limit - countActiveUploads(state))

  if (available === 0) {
    return []
  }

  return state
    .filter((upload) => upload.status === 'queued')
    .slice(0, available)
}

export function summarizeUploads(state: QueuedUpload[]) {
  const total = state.length
  const active = state.filter((upload) => upload.status === 'uploading').length
  const queued = state.filter((upload) => upload.status === 'queued').length
  const success = state.filter((upload) => upload.status === 'success').length
  const failed = state.filter((upload) => upload.status === 'error').length
  const completed = success + failed
  const averageProgress =
    total === 0
      ? 0
      : state.reduce((sum, upload) => sum + upload.progress, 0) / total

  return {
    total,
    active,
    queued,
    success,
    failed,
    completed,
    averageProgress,
    isFinished: total > 0 && completed === total,
  }
}

export function createPreparedUploadBatch(
  files: Iterable<File>,
): PreparedUploadBatch {
  const preparedFiles: PreparedUploadFile[] = []

  for (const file of files) {
    preparedFiles.push({
      file,
      relativePath: getFileRelativePath(file),
    })
  }

  return {
    files: preparedFiles,
    emptyDirectories: [],
  }
}

async function readDirectoryEntries(
  directoryEntry: FileSystemDirectoryEntry,
): Promise<FileSystemEntry[]> {
  const reader = directoryEntry.createReader()
  const entries: FileSystemEntry[] = []

  for (;;) {
    const chunk = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })

    if (chunk.length === 0) {
      return entries
    }

    entries.push(...chunk)
  }
}

async function readFileEntry(fileEntry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject)
  })
}

async function walkEntry(
  entry: FileSystemEntry,
  parentPath: string,
): Promise<PreparedUploadBatch> {
  const nextPath = parentPath ? `${parentPath}/${entry.name}` : entry.name

  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntry)
    return {
      files: [
        {
          file,
          relativePath: nextPath,
        },
      ],
      emptyDirectories: [],
    }
  }

  const children = await readDirectoryEntries(entry as FileSystemDirectoryEntry)

  if (children.length === 0) {
    return {
      files: [],
      emptyDirectories: [
        {
          id: createUploadId(),
          relativePath: nextPath,
        },
      ],
    }
  }

  const nestedBatches = await Promise.all(
    children.map((child) => walkEntry(child, nextPath)),
  )

  return nestedBatches.reduce<PreparedUploadBatch>(
    (acc, batch) => ({
      files: [...acc.files, ...batch.files],
      emptyDirectories: [...acc.emptyDirectories, ...batch.emptyDirectories],
    }),
    { files: [], emptyDirectories: [] },
  )
}

export async function collectDroppedUploadBatch(
  dataTransfer: DataTransfer,
): Promise<PreparedUploadBatch> {
  const items = Array.from(dataTransfer.items ?? [])
  const entryItems = items
    .filter((item) => item.kind === 'file')
    .map(
      (item) =>
        (item as DataTransferItemWithEntry).webkitGetAsEntry?.() ?? null,
    )
    .filter((entry): entry is FileSystemEntry => entry !== null)

  if (entryItems.length === 0) {
    return createPreparedUploadBatch(Array.from(dataTransfer.files))
  }

  const batches = await Promise.all(
    entryItems.map((entry) => walkEntry(entry, '')),
  )
  const fileMap = new Map<string, PreparedUploadFile>()
  const directoryMap = new Map<string, PreparedUploadDirectory>()

  for (const batch of batches) {
    for (const file of batch.files) {
      const key = `${file.relativePath ?? file.file.name}:${file.file.size}:${file.file.lastModified}`
      fileMap.set(key, file)
    }

    for (const directory of batch.emptyDirectories) {
      directoryMap.set(directory.relativePath, directory)
    }
  }

  return {
    files: Array.from(fileMap.values()),
    emptyDirectories: Array.from(directoryMap.values()),
  }
}

export function hasFilePayload(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false
  return Array.from(dataTransfer.types).includes('Files')
}

export function getUploadLabel(upload: QueuedUpload) {
  return upload.relativePath ?? upload.sourceName
}
