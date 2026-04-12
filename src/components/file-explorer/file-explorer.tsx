import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderPlus, Upload } from 'lucide-react'
import { useEffect, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { useTRPC } from '#/integrations/trpc/react'
import type { FileEntry } from '#/lib/storage/types'
import { normalizePath } from '#/lib/storage/path-utils'

import { ExplorerBreadcrumb } from './breadcrumb-nav'
import { CreateFolderDialog } from './create-folder-dialog'
import { FileList, type FileListViewMode } from './file-list'
import { UploadButton } from './upload-button'
import { UploadQueuePanel } from './upload-queue-panel'
import type { PreparedUploadBatch, QueuedUpload } from './upload-types'
import {
  collectDroppedUploadBatch,
  createPreparedUploadBatch,
  createQueuedUploads,
  getNextQueuedUploads,
  hasFilePayload,
  uploadQueueReducer,
} from './upload-utils'

type FileExplorerProps = {
  connectionId: string
  connectionName: string
  path: string
  onPathChange: (path: string) => void
  selectedFilePath?: string
  onSelectedFilePathChange: (
    path: string | null,
    options?: { replace?: boolean },
  ) => void
}

type UploadApiResponse = {
  entry: Omit<FileEntry, 'lastModified'> & {
    lastModified: string | null
  }
  requestedPath: string
  resolvedPath: string
  conflictResolution: 'none' | 'renamed'
}

const MAX_CONCURRENT_UPLOADS = 4

function joinTargetPath(targetPath: string, relativePath: string) {
  return normalizePath(
    targetPath === '/' ? `/${relativePath}` : `${targetPath}/${relativePath}`,
  )
}

function uploadWithProgress(
  upload: QueuedUpload,
  connectionId: string,
  onProgress: (progress: number) => void,
) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const formData = new FormData()
    formData.set('file', upload.file)
    formData.set('connectionId', connectionId)
    formData.set('path', upload.targetPath)
    formData.set('conflictMode', 'rename')

    if (upload.relativePath) {
      formData.set('relativePath', upload.relativePath)
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/files/upload')
    xhr.withCredentials = true

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return
      }

      onProgress((event.loaded / event.total) * 100)
    }

    xhr.onerror = () => {
      reject(new Error('Network error while uploading.'))
    }

    xhr.onabort = () => {
      reject(new Error('Upload canceled.'))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadApiResponse)
        } catch {
          reject(new Error('Invalid upload response.'))
        }
        return
      }

      reject(new Error(xhr.responseText || xhr.statusText || 'Upload failed.'))
    }

    xhr.send(formData)
  })
}

export function FileExplorer({
  connectionId,
  connectionName,
  path,
  onPathChange,
  selectedFilePath,
  onSelectedFilePathChange,
}: FileExplorerProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<FileListViewMode>('grid')
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [uploads, dispatchUpload] = useReducer(uploadQueueReducer, [])
  const [queueExpanded, setQueueExpanded] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const dragDepthRef = useRef(0)
  const inflightUploadIdsRef = useRef(new Set<string>())

  const normalizedPath = normalizePath(path)

  const listQuery = useQuery(
    trpc.files.list.queryOptions(
      {
        connectionId,
        path: normalizedPath,
      },
      { enabled: Boolean(connectionId) },
    ),
  )
  const fileDetailQuery = useQuery(
    trpc.files.stat.queryOptions(
      {
        connectionId,
        path: selectedFilePath ?? '/',
      },
      { enabled: Boolean(connectionId) && Boolean(selectedFilePath) },
    ),
  )

  const mkdirMutation = useMutation(trpc.files.mkdir.mutationOptions())
  const entries = listQuery.data?.entries ?? []

  async function invalidateDirectory(pathToInvalidate: string) {
    await queryClient.invalidateQueries(
      trpc.files.list.queryFilter({
        connectionId,
        path: pathToInvalidate,
      }),
    )
  }

  async function createEmptyDirectories(
    batch: PreparedUploadBatch,
    targetPath: string,
  ) {
    if (batch.emptyDirectories.length === 0) {
      return
    }

    for (const directory of batch.emptyDirectories) {
      const directoryPath = joinTargetPath(targetPath, directory.relativePath)
      await mkdirMutation.mutateAsync({
        connectionId,
        path: directoryPath,
      })
    }

    await invalidateDirectory(targetPath)
  }

  async function enqueueBatch(batch: PreparedUploadBatch, targetPath: string) {
    try {
      await createEmptyDirectories(batch, targetPath)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not create dropped folders.',
      )
    }

    if (batch.files.length === 0) {
      return
    }

    dispatchUpload({
      type: 'enqueue',
      uploads: createQueuedUploads(batch.files, targetPath),
    })
  }

  function handleSelectedFiles(files: File[]) {
    void enqueueBatch(createPreparedUploadBatch(files), normalizedPath)
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!hasFilePayload(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    dragDepthRef.current = 0
    setIsDragActive(false)

    try {
      const batch = await collectDroppedUploadBatch(event.dataTransfer)
      await enqueueBatch(batch, normalizedPath)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not read dropped files.',
      )
    }
  }

  useEffect(() => {
    const nextUploads = getNextQueuedUploads(uploads, MAX_CONCURRENT_UPLOADS)

    for (const upload of nextUploads) {
      if (inflightUploadIdsRef.current.has(upload.id)) {
        continue
      }

      inflightUploadIdsRef.current.add(upload.id)
      dispatchUpload({ type: 'start', id: upload.id })

      void uploadWithProgress(upload, connectionId, (progress) => {
        dispatchUpload({
          type: 'progress',
          id: upload.id,
          progress,
        })
      })
        .then(async (result) => {
          dispatchUpload({
            type: 'success',
            id: upload.id,
            requestedPath: result.requestedPath,
            resolvedPath: result.resolvedPath,
            renamed: result.conflictResolution === 'renamed',
          })
          await invalidateDirectory(upload.targetPath)
        })
        .catch((error) => {
          const message =
            error instanceof Error ? error.message : 'Upload failed.'
          dispatchUpload({
            type: 'error',
            id: upload.id,
            error: message,
          })
          toast.error(message)
        })
        .finally(() => {
          inflightUploadIdsRef.current.delete(upload.id)
        })
    }
  }, [connectionId, queryClient, trpc, uploads])

  useEffect(() => {
    if (fileDetailQuery.data?.isDirectory && selectedFilePath) {
      onSelectedFilePathChange(null, { replace: true })
    }
  }, [
    fileDetailQuery.data?.isDirectory,
    onSelectedFilePathChange,
    selectedFilePath,
  ])

  return (
    <>
      <div className="mx-auto flex w-full min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="relative flex min-h-112 min-w-0 flex-1 flex-col overflow-hidden bg-transparent p-0"
            onDragEnter={(event) => {
              if (!hasFilePayload(event.dataTransfer)) {
                return
              }

              event.preventDefault()
              dragDepthRef.current += 1
              setIsDragActive(true)
            }}
            onDragOver={(event) => {
              if (!hasFilePayload(event.dataTransfer)) {
                return
              }

              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
              setIsDragActive(true)
            }}
            onDragLeave={(event) => {
              if (!hasFilePayload(event.dataTransfer)) {
                return
              }

              event.preventDefault()
              dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
              if (dragDepthRef.current === 0) {
                setIsDragActive(false)
              }
            }}
            onDrop={(event) => {
              void handleDrop(event)
            }}
          >
            <div className="mb-0 flex flex-col gap-3 px-0 py-3 sm:px-0">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <ExplorerBreadcrumb
                    connectionId={connectionId}
                    connectionName={connectionName}
                    path={normalizedPath}
                    onNavigate={onPathChange}
                  />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border bg-card text-foreground hover:bg-accent h-9 rounded-md px-3 font-normal"
                    onClick={() => setCreateFolderOpen(true)}
                  >
                    <FolderPlus className="size-4" />
                    New folder
                  </Button>
                  <UploadButton
                    onSelectFiles={handleSelectedFiles}
                    onSelectFolder={handleSelectedFiles}
                  />
                </div>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-auto px-0 py-0 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]">
              {listQuery.isPending ? (
                <div className="space-y-4">
                  <div className="flex justify-end gap-2 pb-2">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-9 w-28 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-20 rounded" />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 rounded-lg" />
                    ))}
                  </div>
                </div>
              ) : listQuery.isError ? (
                <div className="flex h-full min-h-56 items-center justify-center rounded-lg p-6 text-center">
                  <p className="text-destructive text-sm">
                    {listQuery.error?.message ?? 'Could not load files.'}
                  </p>
                </div>
              ) : (
                <FileList
                  connectionId={connectionId}
                  currentPath={normalizedPath}
                  entries={entries}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onNavigate={onPathChange}
                  selectedFilePath={selectedFilePath}
                  selectedFileEntry={
                    fileDetailQuery.data && !fileDetailQuery.data.isDirectory
                      ? fileDetailQuery.data
                      : null
                  }
                  selectedFileLoading={fileDetailQuery.isPending}
                  selectedFileError={
                    fileDetailQuery.isError
                      ? (fileDetailQuery.error?.message ??
                        'Could not load file.')
                      : null
                  }
                  onSelectedFilePathChange={onSelectedFilePathChange}
                />
              )}

              {isDragActive ? (
                <div className="border-primary bg-background/90 dark:bg-background/85 absolute inset-0 border-2 border-dashed p-5 backdrop-blur-sm">
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="bg-primary/10 text-primary rounded-full p-4">
                      <Upload className="size-6" />
                    </div>
                    <p className="text-foreground mt-4 text-base font-medium">
                      Drop files or folders to upload
                    </p>
                    <p className="text-muted-foreground mt-1 max-w-sm text-sm leading-relaxed">
                      Folder structure stays intact, and conflicts are safely
                      renamed instead of overwritten.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <CreateFolderDialog
            open={createFolderOpen}
            onOpenChange={setCreateFolderOpen}
            connectionId={connectionId}
            parentPath={normalizedPath}
          />
        </div>
      </div>

      <UploadQueuePanel
        uploads={uploads}
        expanded={queueExpanded}
        onExpandedChange={setQueueExpanded}
        onDismissComplete={() => {
          dispatchUpload({ type: 'dismiss-complete' })
        }}
        onRemoveUpload={(id) => {
          dispatchUpload({ type: 'remove', id })
        }}
      />
    </>
  )
}
