export type QueuedUploadStatus =
  | 'queued'
  | 'uploading'
  | 'success'
  | 'error'
  | 'canceled'

export type PreparedUploadFile = {
  file: File
  relativePath: string | null
}

export type PreparedUploadDirectory = {
  id: string
  relativePath: string
}

export type PreparedUploadBatch = {
  files: PreparedUploadFile[]
  emptyDirectories: PreparedUploadDirectory[]
}

export type QueuedUpload = {
  id: string
  file: File
  sourceName: string
  relativePath: string | null
  targetPath: string
  progress: number
  status: QueuedUploadStatus
  requestedPath: string | null
  resolvedPath: string | null
  renamed: boolean
  error: string | null
}
