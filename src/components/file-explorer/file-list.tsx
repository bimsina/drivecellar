import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Download,
  FileIcon,
  FolderIcon,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Shield,
  Trash2,
} from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useState,
  useCallback,
  type RefObject,
} from 'react'
import {
  AutoSizer,
  List as VirtualizedList,
  WindowScroller,
} from 'react-virtualized'
import { toast } from 'sonner'

import { SortToolbar, type ToolbarSortField } from '#/components/sort-toolbar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import { Button } from '#/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '#/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { FieldError } from '#/components/ui/field-error'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { useTRPC } from '#/integrations/trpc/react'
import type { PermissionAccess } from '#/lib/connections'
import type { FileEntry } from '#/lib/storage/types'
import { normalizePath, PathError } from '#/lib/storage/path-utils'
import { cn } from '#/lib/utils'

import { FileDetailDialog } from './file-detail-dialog'
import { buildDownloadUrl, isImageEntry } from './preview-utils'

const LIST_VIRTUAL_ROW_HEIGHT = 64
const GRID_FOLDER_CARD_HEIGHT = 64
const GRID_FILE_CARD_HEIGHT = 160
const GRID_SECTION_HEADER_HEIGHT = 32
const GRID_FOLDER_ROW_HEIGHT = GRID_FOLDER_CARD_HEIGHT + 8
const GRID_FILE_ROW_HEIGHT = GRID_FILE_CARD_HEIGHT + 8
const GRID_FOLDER_CARD_STYLE: React.CSSProperties = {
  height: GRID_FOLDER_CARD_HEIGHT,
  minHeight: GRID_FOLDER_CARD_HEIGHT,
}
const GRID_FILE_CARD_STYLE: React.CSSProperties = {
  height: GRID_FILE_CARD_HEIGHT,
  minHeight: GRID_FILE_CARD_HEIGHT,
}

function formatBytes(n: number | null) {
  if (n === null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatCompactDate(value: Date | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value)
}

function replaceNameInPath(oldPath: string, newName: string) {
  const parts = oldPath.split('/').filter(Boolean)
  if (parts.length === 0) return `/${newName}`
  parts[parts.length - 1] = newName
  return `/${parts.join('/')}`
}

function fileTypeShortLabel(entry: FileEntry) {
  if (entry.isDirectory) return 'Folder'
  const mime = entry.mimeType ?? ''
  if (mime.includes('pdf')) return 'PDF'
  if (mime.startsWith('image/')) {
    const sub = mime.split('/')[1]
    return sub ? sub.toUpperCase() : 'Image'
  }
  if (mime.includes('word') || entry.name.endsWith('.docx')) return 'Word'
  if (mime.includes('sheet') || entry.name.endsWith('.xlsx')) return 'Sheet'
  const ext = entry.name.includes('.')
    ? entry.name.split('.').pop()?.toUpperCase()
    : null
  return ext ?? 'File'
}

function sortEntries<TEntry extends FileEntry>(
  items: TEntry[],
  field: ToolbarSortField,
  ascending: boolean,
): TEntry[] {
  const copy = [...items]
  copy.sort((a, b) => {
    let cmp = 0
    if (field === 'name') {
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    } else if (field === 'modified') {
      const ta = a.lastModified?.getTime() ?? 0
      const tb = b.lastModified?.getTime() ?? 0
      cmp = ta - tb
    } else {
      const sa = a.size ?? 0
      const sb = b.size ?? 0
      cmp = sa - sb
    }
    return ascending ? cmp : -cmp
  })
  return copy
}

function FolderCard({
  entry,
  canWrite,
  canManagePermissions,
  onOpen,
  onManageAccess,
  onRename,
  onDelete,
}: {
  entry: ExplorerFileEntry
  canWrite: boolean
  canManagePermissions: boolean
  onOpen: () => void
  onManageAccess: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <div
      style={GRID_FOLDER_CARD_STYLE}
      className="group border-border/50 bg-card/90 hover:bg-muted/60 flex items-stretch gap-1 rounded-xl border py-0.5 transition-colors duration-150"
    >
      <button
        type="button"
        onClick={onOpen}
        className="text-foreground focus-visible:ring-ring flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-2"
      >
        <span className="bg-primary/10 flex shrink-0 items-center justify-center rounded-lg p-1.5">
          <FolderIcon className="text-primary size-4" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      </button>
      {canWrite ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground/60 hover:text-foreground hover:bg-accent size-9 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            >
              <MoreVertical className="size-[1.125rem]" />
              <span className="sr-only">More actions for {entry.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            {canManagePermissions ? (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onManageAccess()
                }}
              >
                <Shield className="size-4" />
                Manage access
              </DropdownMenuItem>
            ) : null}
            {canWrite ? (
              <>
                {canManagePermissions ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onRename()
                  }}
                >
                  <Pencil className="size-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

function FileCard({
  connectionId,
  entry,
  canWrite,
  canManagePermissions,
  onOpen,
  onManageAccess,
  onRename,
  onDelete,
  onDownload,
}: {
  connectionId: string
  entry: ExplorerFileEntry
  canWrite: boolean
  canManagePermissions: boolean
  onOpen: () => void
  onManageAccess: () => void
  onRename: () => void
  onDelete: () => void
  onDownload: () => void
}) {
  const src = buildDownloadUrl(connectionId, entry.path)
  const showImage = isImageEntry(entry)
  const shortLabel = fileTypeShortLabel(entry)

  return (
    <div
      style={GRID_FILE_CARD_STYLE}
      className="group border-border/50 bg-card/90 hover:bg-muted/60 flex flex-col overflow-hidden rounded-xl border transition-colors duration-150"
    >
      <div className="border-border/30 flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={onOpen}
          className="text-foreground focus-visible:ring-ring min-w-0 flex-1 cursor-pointer truncate text-left text-xs font-medium outline-none focus-visible:ring-2"
        >
          {entry.name}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground/60 hover:text-foreground hover:bg-accent size-7 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <MoreVertical className="size-4" />
              <span className="sr-only">More actions for {entry.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[10rem]">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onDownload()
              }}
            >
              <Download className="size-4" />
              Download
            </DropdownMenuItem>
            {canManagePermissions ? (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onManageAccess()
                }}
              >
                <Shield className="size-4" />
                Manage access
              </DropdownMenuItem>
            ) : null}
            {canWrite ? (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onRename()
                  }}
                >
                  <Pencil className="size-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="bg-muted/30 hover:bg-muted/50 focus-visible:ring-ring flex min-h-[6.5rem] flex-1 cursor-pointer items-center justify-center p-3 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        {showImage ? (
          <img
            src={src}
            alt=""
            className="max-h-[6rem] w-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2">
            <div className="bg-primary/10 flex items-center justify-center rounded-lg p-2">
              <FileIcon className="size-8 opacity-60" strokeWidth={1.5} />
            </div>
            <span className="text-[11px] font-medium">{shortLabel}</span>
          </div>
        )}
      </button>
    </div>
  )
}

export type FileListViewMode = 'grid' | 'list'
export type ExplorerFileEntry = FileEntry & {
  access: PermissionAccess
}

type FileListProps = {
  connectionId: string
  currentPath: string
  canWriteCurrentPath: boolean
  canManagePermissions: boolean
  entries: ExplorerFileEntry[]
  hasMoreEntries: boolean
  isLoadingMoreEntries: boolean
  onLoadMoreEntries: () => void
  scrollContainerRef: RefObject<HTMLDivElement | null>
  viewMode: FileListViewMode
  onViewModeChange: (mode: FileListViewMode) => void
  onNavigate: (path: string) => void
  selectedFilePath?: string
  selectedFileEntry: FileEntry | null
  selectedFileLoading: boolean
  selectedFileError: string | null
  onSelectedFilePathChange: (
    path: string | null,
    options?: { replace?: boolean },
  ) => void
  onManageAccess: (target: {
    path: string
    itemName: string
    isDirectory: boolean
  }) => void
}

export function FileList({
  connectionId,
  currentPath,
  canWriteCurrentPath,
  canManagePermissions,
  entries,
  hasMoreEntries,
  isLoadingMoreEntries,
  onLoadMoreEntries,
  scrollContainerRef,
  viewMode,
  onViewModeChange,
  onNavigate,
  selectedFilePath,
  selectedFileEntry,
  selectedFileLoading,
  selectedFileError,
  onSelectedFilePathChange,
  onManageAccess,
}: FileListProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const renameNameId = useId()
  const [renameTarget, setRenameTarget] = useState<ExplorerFileEntry | null>(
    null,
  )
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ExplorerFileEntry | null>(
    null,
  )
  const [sortField, setSortField] = useState<ToolbarSortField>('name')
  const [sortAscending, setSortAscending] = useState(true)

  const folders = useMemo(() => entries.filter((e) => e.isDirectory), [entries])
  const files = useMemo(() => entries.filter((e) => !e.isDirectory), [entries])

  const sortedFolders = useMemo(
    () => sortEntries(folders, sortField, sortAscending),
    [folders, sortAscending, sortField],
  )
  const sortedFiles = useMemo(
    () => sortEntries(files, sortField, sortAscending),
    [files, sortAscending, sortField],
  )

  async function invalidateList() {
    await queryClient.invalidateQueries(
      trpc.files.list.queryFilter({
        connectionId,
        path: currentPath,
      }),
    )
  }

  const deleteMutation = useMutation(
    trpc.files.delete.mutationOptions({
      onSuccess: async () => {
        await invalidateList()
        toast.success('Deleted.')
        setDeleteTarget(null)
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : 'Delete failed.')
      },
    }),
  )

  const renameMutation = useMutation(
    trpc.files.rename.mutationOptions({
      onSuccess: async () => {
        await invalidateList()
        toast.success('Renamed.')
        setRenameTarget(null)
        setRenameError(null)
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : 'Rename failed.')
      },
    }),
  )

  function openRename(entry: ExplorerFileEntry) {
    if (entry.access !== 'editor') {
      return
    }

    setRenameTarget(entry)
    setRenameValue(entry.name)
    setRenameError(null)
  }

  function submitRename() {
    if (!renameTarget) return
    if (renameTarget.access !== 'editor') {
      setRenameTarget(null)
      return
    }

    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenameError('Enter a name.')
      return
    }
    if (trimmed === renameTarget.name) {
      setRenameTarget(null)
      return
    }

    let newPath: string
    try {
      newPath = normalizePath(replaceNameInPath(renameTarget.path, trimmed))
    } catch (e) {
      if (e instanceof PathError) {
        setRenameError(e.message)
      }
      return
    }

    setRenameError(null)
    renameMutation.mutate({
      connectionId,
      oldPath: renameTarget.path,
      newPath,
    })
  }

  function triggerDownload(entry: FileEntry) {
    const url = buildDownloadUrl(connectionId, entry.path)
    window.location.assign(url)
  }

  function rowForEntry(entry: ExplorerFileEntry) {
    const canWrite = entry.access === 'editor'

    const inner =
      viewMode === 'grid' ? (
        entry.isDirectory ? (
          <FolderCard
            entry={entry}
            canWrite={canWrite}
            canManagePermissions={canManagePermissions}
            onOpen={() => onNavigate(entry.path)}
            onManageAccess={() =>
              onManageAccess({
                path: entry.path,
                itemName: entry.name,
                isDirectory: true,
              })
            }
            onRename={() => openRename(entry)}
            onDelete={() => {
              if (!canWrite) {
                return
              }
              setDeleteTarget(entry)
            }}
          />
        ) : (
          <FileCard
            connectionId={connectionId}
            entry={entry}
            canWrite={canWrite}
            canManagePermissions={canManagePermissions}
            onOpen={() => onSelectedFilePathChange(entry.path)}
            onManageAccess={() =>
              onManageAccess({
                path: entry.path,
                itemName: entry.name,
                isDirectory: false,
              })
            }
            onRename={() => openRename(entry)}
            onDelete={() => {
              if (!canWrite) {
                return
              }
              setDeleteTarget(entry)
            }}
            onDownload={() => triggerDownload(entry)}
          />
        )
      ) : (
        <div
          className="bg-card/90 hover:bg-muted flex h-full cursor-pointer items-center justify-between gap-3 rounded-lg border-0 px-3 py-2 transition-colors"
          onClick={() => {
            if (entry.isDirectory) {
              onNavigate(entry.path)
            } else {
              onSelectedFilePathChange(entry.path)
            }
          }}
        >
          <span className="inline-flex min-w-0 items-center gap-3">
            <span
              className={cn(
                'flex shrink-0 items-center justify-center',
                entry.isDirectory ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {entry.isDirectory ? (
                <FolderIcon className="size-4 shrink-0" />
              ) : (
                <FileIcon className="size-4 shrink-0" />
              )}
            </span>
            <span className="min-w-0">
              <span className="text-foreground block truncate text-sm font-medium">
                {entry.name}
              </span>
              <span className="text-muted-foreground block text-xs font-normal">
                {entry.isDirectory
                  ? 'Folder'
                  : (entry.mimeType ?? 'Stored file')}
              </span>
            </span>
          </span>
          <div className="ml-2 flex shrink-0 items-center gap-4 text-xs">
            <span className="text-muted-foreground hidden min-w-28 text-right md:block">
              {formatCompactDate(entry.lastModified)}
            </span>
            <span className="text-muted-foreground min-w-16 text-right">
              {entry.isDirectory ? '—' : formatBytes(entry.size)}
            </span>
          </div>
        </div>
      )

    return (
      <ContextMenu key={entry.path}>
        <ContextMenuTrigger asChild>{inner}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={() => triggerDownload(entry)}>
            <Download className="size-4" />
            Download
          </ContextMenuItem>
          {canManagePermissions ? (
            <ContextMenuItem
              onSelect={() =>
                onManageAccess({
                  path: entry.path,
                  itemName: entry.name,
                  isDirectory: entry.isDirectory,
                })
              }
            >
              <Shield className="size-4" />
              Manage access
            </ContextMenuItem>
          ) : null}
          {canWrite ? (
            <>
              <ContextMenuSeparator />

              <ContextMenuItem onSelect={() => openRename(entry)}>
                <Pencil className="size-4" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                variant="destructive"
                onSelect={() => setDeleteTarget(entry)}
              >
                <Trash2 className="size-4" />
                Delete
              </ContextMenuItem>
            </>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  const listCombined = useMemo(
    () => [...sortedFolders, ...sortedFiles],
    [sortedFiles, sortedFolders],
  )
  const [scrollElement, setScrollElement] = useState<
    Element | (Window & typeof globalThis) | null
  >(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    setScrollElement(scrollContainerRef.current ?? window)
  }, [scrollContainerRef])

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) {
      return
    }

    scrollContainer.scrollTop = 0
  }, [scrollContainerRef, viewMode])

  const resolveGridColumns = useCallback((width: number) => {
    if (width >= 1536) return 6
    if (width >= 1280) return 5
    if (width >= 1024) return 4
    if (width >= 768) return 3
    if (width >= 640) return 2
    return 1
  }, [])

  const maybeLoadMore = useCallback(
    (lastVisibleIndex: number) => {
      if (!hasMoreEntries || isLoadingMoreEntries) {
        return
      }

      if (lastVisibleIndex >= listCombined.length - 12) {
        onLoadMoreEntries()
      }
    },
    [
      hasMoreEntries,
      isLoadingMoreEntries,
      listCombined.length,
      onLoadMoreEntries,
    ],
  )

  const handleListRowsRendered = useCallback(
    ({ stopIndex }: { startIndex: number; stopIndex: number }) => {
      maybeLoadMore(stopIndex)
    },
    [maybeLoadMore],
  )

  const listRowRenderer = useCallback(
    ({
      index,
      key,
      style,
    }: {
      index: number
      key: string
      style: React.CSSProperties
    }) => {
      const entry = listCombined[index]
      if (!entry) {
        return null
      }

      return (
        <div key={key} style={style} className="h-16 px-1 py-1">
          {rowForEntry(entry)}
        </div>
      )
    },
    [listCombined],
  )

  return (
    <div className="space-y-6">
      <SortToolbar
        sortField={sortField}
        onSortFieldChange={setSortField}
        sortAscending={sortAscending}
        onToggleSortDirection={() => setSortAscending((v) => !v)}
        trailing={
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => {
              if (v === 'grid' || v === 'list') onViewModeChange(v)
            }}
            variant="outline"
            size="sm"
            aria-label="View mode"
            className="rounded-md border-0 bg-transparent p-0.5"
          >
            <ToggleGroupItem
              value="grid"
              aria-label="Grid view"
              className="text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-foreground size-8 rounded-sm px-0"
            >
              <LayoutGrid className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="list"
              aria-label="List view"
              className="text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-foreground size-8 rounded-sm px-0"
            >
              <List className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      {entries.length === 0 ? (
        <div className="flex min-h-[min(50vh,18rem)] flex-col items-center justify-center px-4 py-12 text-center">
          <div className="bg-muted/60 mb-4 flex items-center justify-center rounded-2xl p-4">
            <FolderIcon
              className="text-muted-foreground/60 size-10"
              strokeWidth={1.25}
            />
          </div>
          <p className="text-foreground mt-2 text-base font-medium">
            This folder is empty
          </p>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
            {canWriteCurrentPath
              ? 'Drop files here, or use New folder and Upload.'
              : 'No files are available here.'}
          </p>
        </div>
      ) : (
        <div className={cn('relative min-h-80', viewMode === 'list' && 'pt-2')}>
          {viewMode === 'list' ? (
            <div className="text-muted-foreground mb-2 grid grid-cols-[1fr_auto] items-center px-3 text-xs">
              <span>Name</span>
              <div className="flex items-center gap-4">
                <span className="hidden min-w-28 text-right md:block">
                  Date modified
                </span>
                <span className="min-w-16 text-right">File size</span>
              </div>
            </div>
          ) : null}
          {scrollElement ? (
            <WindowScroller scrollElement={scrollElement}>
              {({
                height,
                isScrolling,
                onChildScroll,
                registerChild,
                scrollTop,
              }) => (
                <div ref={registerChild}>
                  <AutoSizer disableHeight>
                    {({ width }) => {
                      const columns = resolveGridColumns(width)

                      if (viewMode === 'grid') {
                        const folderRows: ExplorerFileEntry[][] = []
                        for (
                          let i = 0;
                          i < sortedFolders.length;
                          i += columns
                        ) {
                          folderRows.push(sortedFolders.slice(i, i + columns))
                        }

                        const fileRows: ExplorerFileEntry[][] = []
                        for (let i = 0; i < sortedFiles.length; i += columns) {
                          fileRows.push(sortedFiles.slice(i, i + columns))
                        }

                        type GridVirtualRow =
                          | { kind: 'header'; title: string }
                          | {
                              kind: 'entries'
                              section: 'folders' | 'files'
                              entries: ExplorerFileEntry[]
                              endIndex: number
                            }

                        const gridRows: GridVirtualRow[] = []

                        if (folderRows.length > 0) {
                          gridRows.push({ kind: 'header', title: 'Folders' })
                          for (
                            let rowIndex = 0;
                            rowIndex < folderRows.length;
                            rowIndex += 1
                          ) {
                            const rowEntries = folderRows[rowIndex] ?? []
                            const endIndex = Math.min(
                              sortedFolders.length - 1,
                              (rowIndex + 1) * columns - 1,
                            )
                            gridRows.push({
                              kind: 'entries',
                              section: 'folders',
                              entries: rowEntries,
                              endIndex,
                            })
                          }
                        }

                        if (fileRows.length > 0) {
                          gridRows.push({ kind: 'header', title: 'Files' })
                          for (
                            let rowIndex = 0;
                            rowIndex < fileRows.length;
                            rowIndex += 1
                          ) {
                            const rowEntries = fileRows[rowIndex] ?? []
                            const endIndex =
                              sortedFolders.length +
                              Math.min(
                                sortedFiles.length - 1,
                                (rowIndex + 1) * columns - 1,
                              )
                            gridRows.push({
                              kind: 'entries',
                              section: 'files',
                              entries: rowEntries,
                              endIndex,
                            })
                          }
                        }

                        const handleGridRowsRendered = ({
                          stopIndex,
                        }: {
                          startIndex: number
                          stopIndex: number
                        }) => {
                          const lastRow = gridRows[stopIndex]
                          if (!lastRow || lastRow.kind !== 'entries') {
                            return
                          }

                          maybeLoadMore(lastRow.endIndex)
                        }

                        const gridRowRenderer = ({
                          index,
                          key,
                          style,
                        }: {
                          index: number
                          key: string
                          style: React.CSSProperties
                        }) => {
                          const row = gridRows[index]
                          if (!row) {
                            return null
                          }

                          if (row.kind === 'header') {
                            return (
                              <div
                                key={key}
                                style={style}
                                className="text-muted-foreground px-2 pt-2 text-xs font-medium"
                              >
                                {row.title}
                              </div>
                            )
                          }

                          return (
                            <div key={key} style={style} className="px-1 py-1">
                              <div
                                className="grid gap-2"
                                style={{
                                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                                }}
                              >
                                {row.entries.map((entry) => (
                                  <div key={entry.path}>
                                    {rowForEntry(entry)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        }

                        return (
                          <VirtualizedList
                            autoHeight
                            width={width}
                            height={height}
                            rowCount={gridRows.length}
                            rowHeight={({ index }) => {
                              const row = gridRows[index]
                              if (!row) {
                                return GRID_FILE_ROW_HEIGHT
                              }

                              if (row.kind === 'header') {
                                return GRID_SECTION_HEADER_HEIGHT
                              }

                              return row.section === 'folders'
                                ? GRID_FOLDER_ROW_HEIGHT
                                : GRID_FILE_ROW_HEIGHT
                            }}
                            rowRenderer={gridRowRenderer}
                            isScrolling={isScrolling}
                            onRowsRendered={handleGridRowsRendered}
                            onScroll={onChildScroll}
                            scrollTop={scrollTop}
                            overscanRowCount={5}
                          />
                        )
                      }

                      return (
                        <VirtualizedList
                          autoHeight
                          width={width}
                          height={height}
                          rowCount={listCombined.length}
                          rowHeight={LIST_VIRTUAL_ROW_HEIGHT}
                          rowRenderer={listRowRenderer}
                          onRowsRendered={handleListRowsRendered}
                          onScroll={onChildScroll}
                          scrollTop={scrollTop}
                          isScrolling={isScrolling}
                          overscanRowCount={10}
                        />
                      )
                    }}
                  </AutoSizer>
                </div>
              )}
            </WindowScroller>
          ) : null}
          {isLoadingMoreEntries ? (
            <p className="text-muted-foreground py-3 text-center text-xs">
              Loading more…
            </p>
          ) : null}
          {!hasMoreEntries && entries.length > 0 ? (
            <p className="text-muted-foreground py-3 text-center text-xs">
              End of results
            </p>
          ) : null}
        </div>
      )}

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
      >
        <DialogContent className="border-border bg-card border sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitRename()
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-foreground">Rename</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Enter a new name for this item.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor={renameNameId} className="text-foreground">
                Name
              </Label>
              <Input
                id={renameNameId}
                value={renameValue}
                onChange={(ev) => setRenameValue(ev.target.value)}
                disabled={renameMutation.isPending}
                className="border-border"
              />
              {renameError ? <FieldError errors={[renameError]} /> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
                disabled={renameMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={renameMutation.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className="border-border bg-card border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete {deleteTarget?.name ?? 'item'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This cannot be undone. Nested files in a folder will be removed as
              well where supported.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={(ev) => {
                ev.preventDefault()
                if (!deleteTarget) return
                if (deleteTarget.access !== 'editor') {
                  setDeleteTarget(null)
                  return
                }
                deleteMutation.mutate({
                  connectionId,
                  path: deleteTarget.path,
                })
              }}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FileDetailDialog
        connectionId={connectionId}
        entry={selectedFileEntry}
        requestedPath={selectedFilePath ?? null}
        loading={selectedFileLoading}
        errorMessage={selectedFileError}
        canManagePermissions={canManagePermissions}
        open={Boolean(selectedFilePath)}
        onOpenChange={(next) => {
          if (!next) {
            onSelectedFilePathChange(null, { replace: true })
          }
        }}
        onDownload={triggerDownload}
        onManageAccess={(target) => {
          onManageAccess({
            path: target.path,
            itemName: target.itemName,
            isDirectory: false,
          })
        }}
      />
    </div>
  )
}
