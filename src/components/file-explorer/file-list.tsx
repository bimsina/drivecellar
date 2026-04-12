import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Download,
  FileIcon,
  FolderIcon,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useId, useMemo, useState } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { useTRPC } from '#/integrations/trpc/react'
import type { FileEntry } from '#/lib/storage/types'
import { normalizePath, PathError } from '#/lib/storage/path-utils'
import { cn } from '#/lib/utils'

import { FileDetailDialog } from './file-detail-dialog'
import { buildDownloadUrl, isImageEntry } from './preview-utils'

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

function fileTypeBadgeClass(entry: FileEntry) {
  if (entry.isDirectory) return 'bg-secondary text-secondary-foreground'
  const mime = entry.mimeType ?? ''
  if (mime.includes('pdf'))
    return 'bg-destructive/90 text-destructive-foreground'
  if (mime.startsWith('image/')) return 'bg-chart-4/25 text-chart-4'
  if (mime.includes('zip') || entry.name.endsWith('.zip'))
    return 'bg-chart-5/25 text-chart-5'
  if (mime.includes('video')) return 'bg-chart-3/25 text-chart-3'
  return 'bg-muted text-muted-foreground'
}

function sortEntries(
  items: FileEntry[],
  field: ToolbarSortField,
  ascending: boolean,
): FileEntry[] {
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
  onOpen,
  onRename,
  onDelete,
}: {
  entry: FileEntry
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <div className="border-border/50 bg-card/90 hover:border-border/70 hover:bg-muted flex items-stretch gap-1 rounded-lg border py-0.5 shadow-[0_1px_2px_rgba(60,64,67,0.04)] transition-colors dark:shadow-none">
      <button
        type="button"
        onClick={onOpen}
        className="text-foreground focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2.5 text-left text-sm font-medium outline-none focus-visible:ring-2"
      >
        <FolderIcon
          className="text-muted-foreground size-5 shrink-0"
          strokeWidth={1.5}
        />
        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-accent/80 size-9 shrink-0"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <MoreVertical className="size-[1.125rem]" />
            <span className="sr-only">More actions for {entry.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[10rem]">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onOpen()
            }}
          >
            Open
          </DropdownMenuItem>
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function FileCard({
  connectionId,
  entry,
  onOpen,
  onRename,
  onDelete,
  onDownload,
}: {
  connectionId: string
  entry: FileEntry
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
  onDownload: () => void
}) {
  const src = buildDownloadUrl(connectionId, entry.path)
  const showImage = isImageEntry(entry)
  const shortLabel = fileTypeShortLabel(entry)
  const badgeClass = fileTypeBadgeClass(entry)

  return (
    <div className="border-border/50 bg-card/90 hover:border-border/65 hover:bg-muted flex min-h-[10rem] flex-col overflow-hidden rounded-lg border shadow-[0_1px_2px_rgba(60,64,67,0.05)] transition-colors dark:shadow-none">
      <div className="border-border/35 flex items-start gap-2 border-b px-2 py-1.5">
        <span
          className={cn(
            'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none font-medium tracking-wide uppercase',
            badgeClass,
          )}
        >
          {shortLabel}
        </span>
        <button
          type="button"
          onClick={onOpen}
          className="text-foreground focus-visible:ring-ring min-w-0 flex-1 truncate pt-0.5 text-left text-xs font-medium outline-none focus-visible:ring-2"
        >
          {entry.name}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-accent/80 size-7 shrink-0"
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="bg-muted/50 focus-visible:ring-ring flex min-h-[6.5rem] flex-1 items-center justify-center p-2 outline-none focus-visible:ring-2 focus-visible:ring-inset"
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
            <FileIcon className="size-10 opacity-50" strokeWidth={1.25} />
            <span className="text-[11px]">{shortLabel}</span>
          </div>
        )}
      </button>
    </div>
  )
}

export type FileListViewMode = 'grid' | 'list'

type FileListProps = {
  connectionId: string
  currentPath: string
  entries: FileEntry[]
  viewMode: FileListViewMode
  onViewModeChange: (mode: FileListViewMode) => void
  onNavigate: (path: string) => void
}

export function FileList({
  connectionId,
  currentPath,
  entries,
  viewMode,
  onViewModeChange,
  onNavigate,
}: FileListProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const renameNameId = useId()
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null)
  const [detailEntry, setDetailEntry] = useState<FileEntry | null>(null)
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
        setDetailEntry(null)
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

  function openRename(entry: FileEntry) {
    setRenameTarget(entry)
    setRenameValue(entry.name)
    setRenameError(null)
  }

  function submitRename() {
    if (!renameTarget) return
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

  function rowForEntry(entry: FileEntry) {
    const inner =
      viewMode === 'grid' ? (
        entry.isDirectory ? (
          <FolderCard
            entry={entry}
            onOpen={() => onNavigate(entry.path)}
            onRename={() => openRename(entry)}
            onDelete={() => setDeleteTarget(entry)}
          />
        ) : (
          <FileCard
            connectionId={connectionId}
            entry={entry}
            onOpen={() => setDetailEntry(entry)}
            onRename={() => openRename(entry)}
            onDelete={() => setDeleteTarget(entry)}
            onDownload={() => triggerDownload(entry)}
          />
        )
      ) : (
        <TableRow
          className="bg-card/90 hover:bg-muted cursor-pointer border-0 transition-colors"
          onClick={() => {
            if (entry.isDirectory) {
              onNavigate(entry.path)
            } else {
              setDetailEntry(entry)
            }
          }}
        >
          <TableCell className="font-medium">
            <span className="inline-flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  'flex shrink-0 items-center justify-center',
                  entry.isDirectory
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {entry.isDirectory ? (
                  <FolderIcon className="size-4 shrink-0" />
                ) : (
                  <FileIcon className="size-4 shrink-0" />
                )}
              </span>
              <span className="min-w-0">
                <span className="text-foreground block truncate">
                  {entry.name}
                </span>
                <span className="text-muted-foreground block text-xs font-normal">
                  {entry.isDirectory
                    ? 'Folder'
                    : (entry.mimeType ?? 'Stored file')}
                </span>
              </span>
            </span>
          </TableCell>
          <TableCell className="text-muted-foreground hidden md:table-cell">
            {formatCompactDate(entry.lastModified)}
          </TableCell>
          <TableCell className="text-muted-foreground text-right">
            {entry.isDirectory ? '—' : formatBytes(entry.size)}
          </TableCell>
        </TableRow>
      )

    return (
      <ContextMenu key={entry.path}>
        <ContextMenuTrigger asChild>{inner}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {entry.isDirectory ? (
            <ContextMenuItem onSelect={() => onNavigate(entry.path)}>
              Open
            </ContextMenuItem>
          ) : (
            <>
              <ContextMenuItem onSelect={() => setDetailEntry(entry)}>
                Open
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => triggerDownload(entry)}>
                <Download className="size-4" />
                Download
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
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
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  const listCombined = useMemo(
    () => [...sortedFolders, ...sortedFiles],
    [sortedFiles, sortedFolders],
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
          <FolderIcon
            className="text-muted-foreground size-10"
            strokeWidth={1.25}
          />
          <p className="text-foreground mt-4 text-sm font-medium">
            This folder is empty
          </p>
          <p className="text-muted-foreground mt-1 max-w-sm text-sm leading-relaxed">
            Drop files here, or use New folder and Upload.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-8">
          {sortedFolders.length > 0 ? (
            <section>
              <h3 className="text-foreground mb-3 text-sm font-medium">
                Folders
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {sortedFolders.map((e) => rowForEntry(e))}
              </div>
            </section>
          ) : null}
          {sortedFiles.length > 0 ? (
            <section>
              <h3 className="text-foreground mb-3 text-sm font-medium">
                Files
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {sortedFiles.map((e) => rowForEntry(e))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-0 bg-transparent hover:bg-transparent">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">
                  Date modified
                </TableHead>
                <TableHead className="text-muted-foreground text-right">
                  File size
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-border/60 divide-y">
              {listCombined.map((e) => rowForEntry(e))}
            </TableBody>
          </Table>
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
        entry={detailEntry}
        open={detailEntry !== null}
        onOpenChange={(next) => {
          if (!next) setDetailEntry(null)
        }}
        onDownload={triggerDownload}
        onRename={openRename}
        onDelete={setDeleteTarget}
      />
    </div>
  )
}
