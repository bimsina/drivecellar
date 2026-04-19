import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Download,
  FileIcon,
  FolderCog,
  FolderIcon,
  Info,
  LayoutGrid,
  List,
  Pencil,
  Shield,
  Tag,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
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
import { ColorPicker } from '#/components/ui/color-picker'
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
import { DynamicIcon } from '#/components/ui/dynamic-icon'
import { FieldError } from '#/components/ui/field-error'
import { IconPicker } from '#/components/ui/icon-picker'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { TagBadges } from '#/components/tags/tag-badges'
import { TagManager } from '#/components/tags/tag-manager'
import { useTRPC } from '#/integrations/trpc/react'
import { getPaletteIconBadgeStyle } from '#/lib/color-palette.ts'
import type { PermissionAccess } from '#/lib/connections'
import type { FileEntry } from '#/lib/storage/types'
import { normalizePath, PathError } from '#/lib/storage/path-utils'
import type { TagListItem } from '#/lib/tags.ts'
import { cn } from '#/lib/utils'

import { buildDownloadUrl, isImageEntry } from './preview-utils'

const LIST_VIRTUAL_ROW_HEIGHT = 64
const GRID_FOLDER_CARD_HEIGHT = 78
const GRID_FILE_CARD_HEIGHT = 182
const GRID_SECTION_HEADER_HEIGHT = 36
const GRID_FOLDER_ROW_HEIGHT = GRID_FOLDER_CARD_HEIGHT + 10
const GRID_FILE_ROW_HEIGHT = GRID_FILE_CARD_HEIGHT + 10
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
  if (!value) {
    return '—'
  }

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

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const media = window.matchMedia('(pointer: coarse)')
    const update = () => setCoarse(media.matches)

    update()
    media.addEventListener('change', update)
    return () => {
      media.removeEventListener('change', update)
    }
  }, [])

  return coarse
}

function getInitialSelectionIndex(
  key: string,
  itemCount: number,
  viewMode: FileListViewMode,
) {
  if (itemCount === 0) {
    return -1
  }

  if (key === 'End') {
    return itemCount - 1
  }

  if (viewMode === 'grid' && (key === 'ArrowUp' || key === 'ArrowLeft')) {
    return itemCount - 1
  }

  return 0
}

function isEntryActionTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest(
      'button, a, input, textarea, select, [contenteditable="true"], [role="menuitem"]',
    ),
  )
}

export type FileListViewMode = 'grid' | 'list'
export type ExplorerFileEntry = FileEntry & {
  access: PermissionAccess
  color: string | null
  icon: string | null
}

type BaseEntryProps = {
  connectionId: string
  entry: ExplorerFileEntry
  tags: TagListItem[]
  canWrite: boolean
  canManagePermissions: boolean
  isSelected: boolean
  onSelect: () => void
  onActivate: () => void
  onManageAccess: () => void
  onShowDetails: () => void
  onCustomize: () => void
  onRename: () => void
  onDelete: () => void
  onDownload: () => void
}

function FolderCard({
  connectionId,
  entry,
  tags,
  isSelected,
  onSelect,
  onActivate,
}: BaseEntryProps) {
  return (
    <div
      data-selected={isSelected ? 'true' : undefined}
      style={GRID_FOLDER_CARD_STYLE}
      onClick={onSelect}
      onDoubleClick={onActivate}
      onContextMenuCapture={onSelect}
      className={cn(
        'group flex cursor-default items-stretch gap-2 rounded-sm border px-2 py-1.5 transition-[background-color,border-color,box-shadow] duration-150',
        isSelected
          ? 'border-primary/25 bg-primary/[0.08] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_16%,transparent)]'
          : 'border-border/75 bg-card/92 hover:border-border hover:bg-muted/72',
      )}
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-3 rounded-sm px-3 py-2"
        role="button"
        tabIndex={-1}
        aria-pressed={isSelected}
      >
        <span
          className="text-primary flex size-11 shrink-0 items-center justify-center"
          style={getPaletteIconBadgeStyle(entry.color)}
        >
          <DynamicIcon
            value={entry.icon}
            fallback={<FolderIcon className="size-4.5" strokeWidth={2} />}
            className="size-4.5"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-sm font-semibold">
            {entry.name}
          </span>
          <span className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
            <span>Folder</span>
            <TagBadges tags={tags} size="sm" maxVisible={2} />
          </span>
        </span>
      </div>
    </div>
  )
}

function FileCard({
  connectionId,
  entry,
  tags,
  isSelected,
  onSelect,
  onActivate,
}: BaseEntryProps) {
  const src = buildDownloadUrl(connectionId, entry.path)
  const showImage = isImageEntry(entry)
  const shortLabel = fileTypeShortLabel(entry)

  return (
    <div
      data-selected={isSelected ? 'true' : undefined}
      style={GRID_FILE_CARD_STYLE}
      onClick={onSelect}
      onDoubleClick={onActivate}
      onContextMenuCapture={onSelect}
      className={cn(
        'group flex cursor-default flex-col overflow-hidden rounded-sm border transition-[background-color,border-color,box-shadow] duration-150',
        isSelected
          ? 'border-primary/25 bg-primary/[0.08] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_16%,transparent)]'
          : 'border-border/75 bg-card/92 hover:border-border hover:bg-muted/72',
      )}
    >
      <div className="border-border/50 flex items-start gap-2 border-b px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-semibold">
            {entry.name}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {shortLabel}
            {entry.size !== null ? ` · ${formatBytes(entry.size)}` : ''}
          </p>
          <TagBadges tags={tags} size="sm" maxVisible={2} className="mt-2" />
        </div>
      </div>

      <div
        className="bg-muted/35 flex min-h-28 flex-1 items-center justify-center px-4 py-4"
        role="button"
        tabIndex={-1}
        aria-pressed={isSelected}
      >
        {showImage ? (
          <img
            src={src}
            alt=""
            className="max-h-24 w-full max-w-full rounded-sm object-contain"
            loading="lazy"
          />
        ) : (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-2">
            <div className="text-primary flex items-center justify-center p-3">
              <FileIcon className="size-8" strokeWidth={1.6} />
            </div>
            <span className="text-[11px] font-semibold">{shortLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
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
  onOpenFile: (filePath: string) => void
  onManageAccess: (target: {
    path: string
    itemName: string
    isDirectory: boolean
  }) => void
  tagsByPath: Record<string, TagListItem[]>
  selectedPath: string | null
  onSelectedPathChange: (path: string | null) => void
  inspectorOpen: boolean
  onInspectorOpenChange: (open: boolean) => void
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
  onOpenFile,
  onManageAccess,
  tagsByPath,
  selectedPath,
  onSelectedPathChange,
  inspectorOpen,
  onInspectorOpenChange,
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
  const [metaTarget, setMetaTarget] = useState<ExplorerFileEntry | null>(null)
  const [metaColor, setMetaColor] = useState<string | null>(null)
  const [metaIcon, setMetaIcon] = useState<string | null>(null)
  const [sortField, setSortField] = useState<ToolbarSortField>('name')
  const [sortAscending, setSortAscending] = useState(true)
  const coarsePointer = useCoarsePointer()
  const interactionRef = useRef<HTMLDivElement | null>(null)
  const entryRefs = useRef(new Map<string, HTMLDivElement>())
  const gridColumnsRef = useRef(1)

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

  const listCombined = useMemo(
    () => [...sortedFolders, ...sortedFiles],
    [sortedFiles, sortedFolders],
  )

  useEffect(() => {
    if (!selectedPath) {
      return
    }

    const stillExists = listCombined.some(
      (entry) => entry.path === selectedPath,
    )
    if (!stillExists) {
      onSelectedPathChange(null)
    }
  }, [listCombined, onSelectedPathChange, selectedPath])

  const selectedIndex = useMemo(
    () => listCombined.findIndex((entry) => entry.path === selectedPath),
    [listCombined, selectedPath],
  )

  const focusExplorerTarget = useCallback(() => {
    if (coarsePointer) {
      return
    }

    if (selectedPath) {
      const selectedElement = entryRefs.current.get(selectedPath)

      if (selectedElement) {
        selectedElement.focus({ preventScroll: true })
        selectedElement.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
        })
        return
      }
    }

    interactionRef.current?.focus({ preventScroll: true })
  }, [coarsePointer, selectedPath])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      focusExplorerTarget()
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [focusExplorerTarget, inspectorOpen, selectedPath])

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
  const updateMetaMutation = useMutation(
    trpc.files.updateMeta.mutationOptions({
      onSuccess: async () => {
        await invalidateList()
        toast.success('Updated.')
        setMetaTarget(null)
      },
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : 'Could not update.',
        )
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

  function openCustomize(entry: ExplorerFileEntry) {
    if (entry.access !== 'editor') {
      return
    }
    setMetaTarget(entry)
    setMetaColor(entry.color)
    setMetaIcon(entry.icon)
  }

  function submitCustomize() {
    if (!metaTarget) {
      return
    }

    updateMetaMutation.mutate({
      connectionId,
      path: metaTarget.path,
      color: metaColor,
      icon: metaIcon,
    })
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

  function openEntry(entry: ExplorerFileEntry) {
    if (entry.isDirectory) {
      onNavigate(entry.path)
      return
    }

    onOpenFile(entry.path)
  }

  function selectEntry(path: string) {
    onSelectedPathChange(path)
  }

  function handleEntryInteraction(entry: ExplorerFileEntry) {
    selectEntry(entry.path)

    if (coarsePointer) {
      openEntry(entry)
    }
  }

  function handleShowDetails(entry: ExplorerFileEntry) {
    selectEntry(entry.path)
    onInspectorOpenChange(true)
  }

  function renderContextMenu(entry: ExplorerFileEntry, tags: TagListItem[]) {
    const canWrite = entry.access === 'editor'

    return (
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={() => handleShowDetails(entry)}>
          <Info className="size-4" />
          Show details
        </ContextMenuItem>
        {!entry.isDirectory ? (
          <ContextMenuItem onSelect={() => triggerDownload(entry)}>
            <Download className="size-4" />
            Download
          </ContextMenuItem>
        ) : null}
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
        <TagManager
          connectionId={connectionId}
          path={entry.path}
          currentTagIds={tags.map((tag) => tag.id)}
          trigger={
            <ContextMenuItem
              onSelect={(event) => {
                event.preventDefault()
              }}
            >
              <Tag className="size-4" />
              Tags
            </ContextMenuItem>
          }
        />
        {canWrite ? (
          <>
            <ContextMenuSeparator />
            {entry.isDirectory ? (
              <ContextMenuItem onSelect={() => openCustomize(entry)}>
                <FolderCog className="size-4" />
                Customize
              </ContextMenuItem>
            ) : null}
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
    )
  }

  function rowForEntry(entry: ExplorerFileEntry) {
    const canWrite = entry.access === 'editor'
    const tags = tagsByPath[entry.path] ?? []
    const isSelected = entry.path === selectedPath

    const inner =
      viewMode === 'grid' ? (
        entry.isDirectory ? (
          <FolderCard
            connectionId={connectionId}
            entry={entry}
            tags={tags}
            canWrite={canWrite}
            canManagePermissions={canManagePermissions}
            isSelected={isSelected}
            onSelect={() => handleEntryInteraction(entry)}
            onActivate={() => openEntry(entry)}
            onManageAccess={() =>
              onManageAccess({
                path: entry.path,
                itemName: entry.name,
                isDirectory: true,
              })
            }
            onShowDetails={() => handleShowDetails(entry)}
            onCustomize={() => openCustomize(entry)}
            onRename={() => openRename(entry)}
            onDelete={() => {
              if (!canWrite) {
                return
              }
              setDeleteTarget(entry)
            }}
            onDownload={() => triggerDownload(entry)}
          />
        ) : (
          <FileCard
            connectionId={connectionId}
            entry={entry}
            tags={tags}
            canWrite={canWrite}
            canManagePermissions={canManagePermissions}
            isSelected={isSelected}
            onSelect={() => handleEntryInteraction(entry)}
            onActivate={() => openEntry(entry)}
            onManageAccess={() =>
              onManageAccess({
                path: entry.path,
                itemName: entry.name,
                isDirectory: false,
              })
            }
            onShowDetails={() => handleShowDetails(entry)}
            onCustomize={() => openCustomize(entry)}
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
          data-selected={isSelected ? 'true' : undefined}
          onClick={() => handleEntryInteraction(entry)}
          onDoubleClick={() => openEntry(entry)}
          onContextMenuCapture={() => selectEntry(entry.path)}
          className={cn(
            'group flex h-full min-h-0 cursor-default items-center justify-between gap-3 rounded-sm border px-3 py-2 transition-[background-color,border-color,box-shadow]',
            isSelected
              ? 'border-primary/25 bg-primary/[0.08] shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_16%,transparent)]'
              : 'border-border/70 bg-card/94 hover:border-border hover:bg-muted/72',
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-3">
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center',
                entry.isDirectory ? 'text-primary' : 'text-muted-foreground',
              )}
              style={
                entry.isDirectory
                  ? getPaletteIconBadgeStyle(entry.color)
                  : undefined
              }
            >
              {entry.isDirectory ? (
                <DynamicIcon
                  value={entry.icon}
                  fallback={<FolderIcon className="size-4.5 shrink-0" />}
                  className="size-4.5 shrink-0"
                />
              ) : (
                <FileIcon className="size-4.5 shrink-0" />
              )}
            </span>
            <span className="min-w-0">
              <span className="text-foreground block truncate text-sm font-semibold">
                {entry.name}
              </span>
              <span className="text-muted-foreground mt-1 flex items-center gap-2 text-xs font-normal">
                <span>
                  {entry.isDirectory
                    ? 'Folder'
                    : (entry.mimeType ?? fileTypeShortLabel(entry))}
                </span>
                <TagBadges tags={tags} size="sm" maxVisible={1} />
              </span>
            </span>
          </span>

          <div className="ml-2 flex shrink-0 items-center gap-4">
            <div className="text-muted-foreground hidden min-w-28 text-right text-xs md:block">
              {formatCompactDate(entry.lastModified)}
            </div>
            <div className="text-muted-foreground min-w-16 text-right text-xs">
              {entry.isDirectory ? '—' : formatBytes(entry.size)}
            </div>
          </div>
        </div>
      )

    return (
      <ContextMenu key={entry.path}>
        <ContextMenuTrigger asChild>
          <div {...getEntryWrapperProps(entry)}>{inner}</div>
        </ContextMenuTrigger>
        {renderContextMenu(entry, tags)}
      </ContextMenu>
    )
  }

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
        <div
          key={key}
          style={style}
          className="h-[64px] overflow-hidden px-1 py-1"
        >
          {rowForEntry(entry)}
        </div>
      )
    },
    [listCombined, rowForEntry],
  )

  const moveSelection = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(listCombined.length - 1, nextIndex))
      const entry = listCombined[clamped]
      if (!entry) {
        return
      }

      onSelectedPathChange(entry.path)
      const nextElement = entryRefs.current.get(entry.path)
      nextElement?.focus({ preventScroll: true })
    },
    [listCombined, onSelectedPathChange],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (
        event.target !== event.currentTarget &&
        isEntryActionTarget(event.target)
      ) {
        return
      }

      if (listCombined.length === 0) {
        if (event.key === 'Escape' && inspectorOpen) {
          event.preventDefault()
          onInspectorOpenChange(false)
        }
        return
      }

      if (event.key === 'Enter') {
        if (selectedIndex < 0) {
          return
        }
        event.preventDefault()
        const entry = listCombined[selectedIndex]
        if (entry) {
          openEntry(entry)
        }
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        if (selectedPath) {
          onSelectedPathChange(null)
          return
        }
        if (inspectorOpen) {
          onInspectorOpenChange(false)
        }
        return
      }

      if (event.key === 'Home') {
        event.preventDefault()
        moveSelection(0)
        return
      }

      if (event.key === 'End') {
        event.preventDefault()
        moveSelection(listCombined.length - 1)
        return
      }

      const gridStep = Math.max(1, gridColumnsRef.current)
      const initialIndex = getInitialSelectionIndex(
        event.key,
        listCombined.length,
        viewMode,
      )
      const currentIndex = selectedIndex >= 0 ? selectedIndex : initialIndex

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          moveSelection(
            selectedIndex >= 0
              ? currentIndex + (viewMode === 'grid' ? gridStep : 1)
              : initialIndex,
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          moveSelection(
            selectedIndex >= 0
              ? currentIndex - (viewMode === 'grid' ? gridStep : 1)
              : initialIndex,
          )
          break
        case 'ArrowRight':
          if (viewMode !== 'grid') {
            return
          }
          event.preventDefault()
          moveSelection(selectedIndex >= 0 ? currentIndex + 1 : initialIndex)
          break
        case 'ArrowLeft':
          if (viewMode !== 'grid') {
            return
          }
          event.preventDefault()
          moveSelection(selectedIndex >= 0 ? currentIndex - 1 : initialIndex)
          break
        default:
          break
      }
    },
    [
      inspectorOpen,
      listCombined,
      moveSelection,
      onInspectorOpenChange,
      onSelectedPathChange,
      selectedIndex,
      selectedPath,
      viewMode,
    ],
  )

  const getEntryWrapperProps = useCallback(
    (entry: ExplorerFileEntry) => ({
      'data-entry-path': entry.path,
      ref: (node: HTMLDivElement | null) => {
        if (node) {
          entryRefs.current.set(entry.path, node)
        } else {
          entryRefs.current.delete(entry.path)
        }
      },
      role: 'option' as const,
      'aria-selected': entry.path === selectedPath,
      tabIndex: entry.path === selectedPath ? 0 : -1,
      onKeyDown: handleKeyDown,
      onFocus: () => {
        if (selectedPath !== entry.path) {
          onSelectedPathChange(entry.path)
        }
      },
      className: 'outline-none',
    }),
    [handleKeyDown, onSelectedPathChange, selectedPath],
  )

  return (
    <div className="space-y-3">
      <SortToolbar
        className="px-1 py-1"
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
            className="rounded-sm border-0 bg-transparent p-0.5"
          >
            <ToggleGroupItem
              value="grid"
              aria-label="Grid view"
              className="text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground size-8 rounded-sm px-0 shadow-none"
            >
              <LayoutGrid className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="list"
              aria-label="List view"
              className="text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground size-8 rounded-sm px-0 shadow-none"
            >
              <List className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      {entries.length === 0 ? (
        <div className="bg-muted/35 flex min-h-[min(50vh,18rem)] flex-col items-center justify-center rounded-sm px-4 py-12 text-center">
          <div className="bg-background/65 mb-4 flex items-center justify-center rounded-sm p-4">
            <FolderIcon
              className="text-muted-foreground/70 size-10"
              strokeWidth={1.25}
            />
          </div>
          <p className="text-foreground mt-2 text-base font-semibold">
            This folder is empty
          </p>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
            {canWriteCurrentPath
              ? 'Drop files here, or use New folder and Upload.'
              : 'No files are available here.'}
          </p>
        </div>
      ) : (
        <div
          ref={interactionRef}
          tabIndex={0}
          role="listbox"
          aria-label="Files and folders"
          onKeyDown={handleKeyDown}
          className={cn(
            'min-h-80 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--ring)_20%,transparent)]',
            viewMode === 'list' && 'pt-2',
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <span className="bg-muted rounded-sm px-2 py-1 font-medium">
                {entries.length} {entries.length === 1 ? 'item' : 'items'}
              </span>
              <span>
                {selectedPath
                  ? 'Single click selects, double click opens'
                  : 'Use arrow keys to move between items'}
              </span>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="text-muted-foreground mb-2 grid grid-cols-[1fr_auto] items-center px-4 text-[0.72rem] font-medium tracking-[0.08em] uppercase">
              <span>Name</span>
              <div className="flex items-center gap-4">
                <span className="hidden min-w-28 text-right md:block">
                  Modified
                </span>
                <span className="min-w-16 text-right">Size</span>
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
                      gridColumnsRef.current = columns

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
                                className="text-muted-foreground px-2 pt-2 text-[0.72rem] font-semibold tracking-[0.08em] uppercase"
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

      <Dialog
        open={Boolean(metaTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setMetaTarget(null)
          }
        }}
      >
        <DialogContent className="border-border bg-card border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize folder</DialogTitle>
            <DialogDescription>
              Set a color and icon for this folder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Color</Label>
              <ColorPicker value={metaColor} onChange={setMetaColor} />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <IconPicker value={metaIcon} onChange={setMetaIcon} />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMetaTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitCustomize}
              disabled={updateMetaMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
