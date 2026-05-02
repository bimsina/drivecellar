import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { FolderPlus, Info, Shield, Upload } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { useTRPC } from '#/integrations/trpc/react'
import type { FileEntry } from '#/lib/storage/types'
import { normalizePath } from '#/lib/storage/path-utils'
import type { TagListItem } from '#/lib/tags.ts'
import { cn } from '#/lib/utils'

import { ExplorerBreadcrumb } from './breadcrumb-nav'
import { CreateFolderDialog } from './create-folder-dialog'
import { FileInspector } from './file-inspector'
import { FileList, type FileListViewMode } from './file-list'
import { PathAccessDialog } from './path-access-dialog'
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
  onOpenFile: (filePath: string) => void
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
const FILE_LIST_PAGE_SIZE = 100

function joinTargetPath(targetPath: string, relativePath: string) {
  return normalizePath(
    targetPath === '/' ? `/${relativePath}` : `${targetPath}/${relativePath}`,
  )
}

function itemNameFromPath(path: string, fallbackRootName: string) {
  const normalizedPath = normalizePath(path)

  if (normalizedPath === '/') {
    return fallbackRootName
  }

  const segments = normalizedPath.split('/').filter(Boolean)
  return segments.at(-1) ?? fallbackRootName
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
  onOpenFile,
}: FileExplorerProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<FileListViewMode>('grid')
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [uploads, dispatchUpload] = useReducer(uploadQueueReducer, [])
  const [queueExpanded, setQueueExpanded] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [manageAccessTarget, setManageAccessTarget] = useState<{
    path: string
    itemName: string
    isDirectory: boolean
  } | null>(null)
  const dragDepthRef = useRef(0)
  const inflightUploadIdsRef = useRef(new Set<string>())
  const listScrollContainerRef = useRef<HTMLDivElement | null>(null)

  const normalizedPath = normalizePath(path)

  const firstPageQuery = useQuery(
    trpc.files.list.queryOptions(
      {
        connectionId,
        path: normalizedPath,
        limit: FILE_LIST_PAGE_SIZE,
        cursor: null,
      },
      { enabled: Boolean(connectionId) },
    ),
  )
  const [listPages, setListPages] = useState<
    Array<NonNullable<typeof firstPageQuery.data>>
  >([])
  const [nextCursor, setNextCursor] = useState<{
    folderOffset: number
    fileOffset: number
  } | null>(null)
  const [hasMoreEntries, setHasMoreEntries] = useState(false)
  const [isLoadingMoreEntries, setIsLoadingMoreEntries] = useState(false)
  const myAccessQuery = useQuery(
    trpc.permissions.getMyAccess.queryOptions(
      {
        connectionId,
        path: normalizedPath,
      },
      { enabled: Boolean(connectionId) },
    ),
  )

  const mkdirMutation = useMutation(trpc.files.mkdir.mutationOptions())
  const entries = useMemo(
    () => listPages.flatMap((page) => page.entries),
    [listPages],
  )
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.path === selectedPath) ?? null,
    [entries, selectedPath],
  )
  const tagsForFilesQuery = useQuery(
    trpc.tags.listForFiles.queryOptions(
      {
        connectionId,
        paths: entries.map((entry) => entry.path),
      },
      {
        enabled: Boolean(connectionId) && entries.length > 0,
      },
    ),
  )
  const tagsByPath: Record<string, TagListItem[]> = tagsForFilesQuery.data ?? {}
  const canWriteCurrentPath = myAccessQuery.data?.access === 'editor'
  const canManagePermissions =
    myAccessQuery.data?.organizationRole === 'owner' ||
    myAccessQuery.data?.organizationRole === 'admin'
  const indexStatusQuery = useQuery(
    trpc.indexing.status.queryOptions(
      { connectionId },
      {
        enabled: Boolean(connectionId) && canManagePermissions,
        retry: false,
      },
    ),
  )
  const showNoIndexAlert =
    canManagePermissions &&
    !indexStatusQuery.isPending &&
    !indexStatusQuery.isError &&
    !indexStatusQuery.data

  useEffect(() => {
    setListPages([])
    setNextCursor(null)
    setHasMoreEntries(false)
    setIsLoadingMoreEntries(false)
    setSelectedPath(null)
  }, [connectionId, normalizedPath])

  useEffect(() => {
    if (!firstPageQuery.data) {
      return
    }

    setListPages([firstPageQuery.data])
    setNextCursor(firstPageQuery.data.nextCursor)
    setHasMoreEntries(firstPageQuery.data.hasMore)
  }, [firstPageQuery.data])

  async function invalidateDirectory(pathToInvalidate: string) {
    await queryClient.invalidateQueries(
      trpc.files.list.queryFilter({
        connectionId,
        path: pathToInvalidate,
        cursor: null,
        limit: FILE_LIST_PAGE_SIZE,
      }),
    )
  }

  const loadMoreEntries = useCallback(async () => {
    if (!nextCursor || !hasMoreEntries || isLoadingMoreEntries) {
      return
    }

    setIsLoadingMoreEntries(true)
    try {
      const page = await queryClient.fetchQuery(
        trpc.files.list.queryOptions({
          connectionId,
          path: normalizedPath,
          limit: FILE_LIST_PAGE_SIZE,
          cursor: nextCursor,
        }),
      )

      setListPages((current) => [...current, page])
      setNextCursor(page.nextCursor)
      setHasMoreEntries(page.hasMore)
    } finally {
      setIsLoadingMoreEntries(false)
    }
  }, [
    connectionId,
    hasMoreEntries,
    isLoadingMoreEntries,
    nextCursor,
    normalizedPath,
    queryClient,
    trpc.files.list,
  ])

  async function refreshExplorerPermissions() {
    await Promise.all([
      invalidateDirectory(normalizedPath),
      queryClient.invalidateQueries(
        trpc.permissions.getMyAccess.queryFilter({
          connectionId,
          path: normalizedPath,
        }),
      ),
    ])
  }

  async function createEmptyDirectories(
    batch: PreparedUploadBatch,
    targetPath: string,
  ) {
    if (!canWriteCurrentPath) {
      return
    }

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
    if (!canWriteCurrentPath) {
      return
    }

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
    if (!canWriteCurrentPath) {
      return
    }

    void enqueueBatch(createPreparedUploadBatch(files), normalizedPath)
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!canWriteCurrentPath || !hasFilePayload(event.dataTransfer)) {
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
    if (canWriteCurrentPath) {
      return
    }

    setCreateFolderOpen(false)
    dragDepthRef.current = 0
    setIsDragActive(false)
  }, [canWriteCurrentPath])

  return (
    <>
      <div className="mx-auto flex w-full min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="relative flex min-h-112 min-w-0 flex-1 flex-col overflow-hidden bg-transparent p-0"
            onDragEnter={(event) => {
              if (!canWriteCurrentPath || !hasFilePayload(event.dataTransfer)) {
                return
              }

              event.preventDefault()
              dragDepthRef.current += 1
              setIsDragActive(true)
            }}
            onDragOver={(event) => {
              if (!canWriteCurrentPath || !hasFilePayload(event.dataTransfer)) {
                return
              }

              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
              setIsDragActive(true)
            }}
            onDragLeave={(event) => {
              if (!canWriteCurrentPath || !hasFilePayload(event.dataTransfer)) {
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
            <div className="mb-0 flex min-h-0 flex-1 flex-col gap-3 px-0 py-1 sm:px-0">
              {showNoIndexAlert ? (
                <Alert>
                  <AlertTitle>No index has been run yet</AlertTitle>
                  <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      To start indexing this connection, open the indexing page.
                    </span>
                    <Button asChild type="button" size="sm" variant="outline">
                      <Link to="/indexing/$cid" params={{ cid: connectionId }}>
                        Go to indexing page
                      </Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}
              <div
                className={cn(
                  'grid min-h-0 flex-1 gap-3',
                  inspectorOpen && 'xl:grid-cols-[minmax(0,1fr)_21rem]',
                )}
              >
                <div className="bg-background/24 flex min-h-0 flex-col overflow-hidden rounded-[calc(var(--radius)+8px)] p-1.5">
                  <div className="bg-card/76 mb-2 flex flex-col gap-3 rounded-[calc(var(--radius)+6px)] px-3 py-3">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <h1 className="text-foreground truncate text-base font-semibold">
                          {normalizedPath === '/'
                            ? connectionName
                            : itemNameFromPath(normalizedPath, connectionName)}
                        </h1>
                        <ExplorerBreadcrumb
                          connectionId={connectionId}
                          connectionName={connectionName}
                          path={normalizedPath}
                          onNavigate={onPathChange}
                        />
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant={inspectorOpen ? 'secondary' : 'outline'}
                          size="sm"
                          className="h-8 px-2.5"
                          onMouseDown={(event) => {
                            event.preventDefault()
                          }}
                          onClick={() => setInspectorOpen((open) => !open)}
                        >
                          <Info className="size-4" />
                          Preview
                        </Button>
                        {canManagePermissions ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5"
                            onClick={() => {
                              setManageAccessTarget({
                                path: normalizedPath,
                                itemName:
                                  normalizedPath === '/'
                                    ? `${connectionName} root`
                                    : itemNameFromPath(
                                        normalizedPath,
                                        connectionName,
                                      ),
                                isDirectory: true,
                              })
                            }}
                          >
                            <Shield className="size-4" />
                            Access
                          </Button>
                        ) : null}
                        {canWriteCurrentPath ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5"
                              onClick={() => setCreateFolderOpen(true)}
                            >
                              <FolderPlus className="size-4" />
                              New folder
                            </Button>
                            <UploadButton
                              onSelectFiles={handleSelectedFiles}
                              onSelectFolder={handleSelectedFiles}
                            />
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="bg-card/58 min-h-0 flex-1 overflow-hidden rounded-[calc(var(--radius)+6px)]">
                    <div
                      ref={listScrollContainerRef}
                      className="relative h-full min-h-0 overflow-auto px-0 py-1 pr-1"
                    >
                      {firstPageQuery.isPending ? (
                        <div className="space-y-4">
                          <div className="flex justify-end gap-2 pb-2">
                            <Skeleton className="h-9 w-9 rounded-sm" />
                            <Skeleton className="h-9 w-28 rounded-sm" />
                          </div>
                          <Skeleton className="h-4 w-20 rounded" />
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            {Array.from({ length: 8 }).map((_, i) => (
                              <Skeleton key={i} className="h-11 rounded-sm" />
                            ))}
                          </div>
                        </div>
                      ) : firstPageQuery.isError ? (
                        <div className="flex h-full min-h-56 items-center justify-center rounded-sm p-6 text-center">
                          <p className="text-destructive text-sm">
                            {firstPageQuery.error?.message ??
                              'Could not load files.'}
                          </p>
                        </div>
                      ) : (
                        <FileList
                          connectionId={connectionId}
                          currentPath={normalizedPath}
                          canWriteCurrentPath={canWriteCurrentPath}
                          canManagePermissions={canManagePermissions}
                          entries={entries}
                          hasMoreEntries={hasMoreEntries}
                          isLoadingMoreEntries={isLoadingMoreEntries}
                          onLoadMoreEntries={loadMoreEntries}
                          scrollContainerRef={listScrollContainerRef}
                          viewMode={viewMode}
                          onViewModeChange={setViewMode}
                          onNavigate={onPathChange}
                          onOpenFile={onOpenFile}
                          onManageAccess={setManageAccessTarget}
                          tagsByPath={tagsByPath}
                          selectedPath={selectedPath}
                          onSelectedPathChange={setSelectedPath}
                          inspectorOpen={inspectorOpen}
                          onInspectorOpenChange={setInspectorOpen}
                        />
                      )}

                      {canWriteCurrentPath && isDragActive ? (
                        <div className="border-primary bg-background/90 dark:bg-background/85 absolute inset-0 rounded-[calc(var(--radius)+6px)] border-2 border-dashed p-5 backdrop-blur-sm">
                          <div className="flex h-full flex-col items-center justify-center text-center">
                            <div className="bg-primary/10 text-primary rounded-[calc(var(--radius)+3px)] p-4">
                              <Upload className="size-6" />
                            </div>
                            <p className="text-foreground mt-4 text-base font-medium">
                              Drop files or folders to upload
                            </p>
                            <p className="text-muted-foreground mt-1 max-w-sm text-sm leading-relaxed">
                              Folder structure stays intact, and conflicts are
                              safely renamed instead of overwritten.
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <FileInspector
                  open={inspectorOpen}
                  onOpenChange={setInspectorOpen}
                  connectionId={connectionId}
                  connectionName={connectionName}
                  currentPath={normalizedPath}
                  currentAccess={myAccessQuery.data?.access}
                  selectedEntry={selectedEntry}
                />
              </div>
            </div>
          </div>

          {canWriteCurrentPath ? (
            <CreateFolderDialog
              open={createFolderOpen}
              onOpenChange={setCreateFolderOpen}
              connectionId={connectionId}
              parentPath={normalizedPath}
            />
          ) : null}
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

      {manageAccessTarget ? (
        <PathAccessDialog
          connectionId={connectionId}
          path={manageAccessTarget.path}
          itemName={manageAccessTarget.itemName}
          isDirectory={manageAccessTarget.isDirectory}
          open={Boolean(manageAccessTarget)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setManageAccessTarget(null)
            }
          }}
          onPermissionsChanged={refreshExplorerPermissions}
        />
      ) : null}
    </>
  )
}
