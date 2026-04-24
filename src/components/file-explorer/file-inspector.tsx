import { useQuery } from '@tanstack/react-query'
import {
  CalendarDays,
  FileIcon,
  FolderIcon,
  HardDrive,
  Info,
  Shield,
  Tag,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { TagBadges } from '#/components/tags/tag-badges'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { DynamicIcon } from '#/components/ui/dynamic-icon'
import { Skeleton } from '#/components/ui/skeleton'
import { useTRPC } from '#/integrations/trpc/react'
import { getPaletteIconBadgeStyle } from '#/lib/color-palette'
import type { PermissionAccess } from '#/lib/connections'
import { cn } from '#/lib/utils'

import type { ExplorerFileEntry } from './file-list'
import { PreviewKindIcon } from './native-file-preview'
import { buildInlinePreviewUrl, isImageEntry } from './preview-utils'

function formatBytes(value: number | null) {
  if (value == null) {
    return '—'
  }
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return 'Unavailable'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

function accessLabel(access: PermissionAccess | null | undefined) {
  if (access === 'editor') {
    return 'Can edit'
  }
  if (access === 'viewer') {
    return 'View only'
  }
  return 'Unknown'
}

function typeLabel(entry: {
  isDirectory: boolean
  mimeType: string | null
  name: string
}) {
  if (entry.isDirectory) {
    return 'Folder'
  }

  return (
    entry.mimeType ??
    (entry.name.includes('.')
      ? (entry.name.split('.').pop()?.toUpperCase() ?? 'File')
      : 'File')
  )
}

type FileInspectorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  connectionName: string
  currentPath: string
  currentAccess: PermissionAccess | null | undefined
  selectedEntry: ExplorerFileEntry | null
}

type InspectorSurfaceProps = {
  className?: string
  closeLabel: string
  connectionId: string
  connectionName: string
  currentPath: string
  currentAccess: PermissionAccess | null | undefined
  selectedEntry: ExplorerFileEntry | null
  onClose: () => void
}

function InspectorSurface({
  className,
  closeLabel,
  connectionId,
  connectionName,
  currentPath,
  currentAccess,
  selectedEntry,
  onClose,
}: InspectorSurfaceProps) {
  const trpc = useTRPC()
  const inspectedPath = selectedEntry?.path ?? currentPath
  const isCurrentLocation = !selectedEntry
  const fallbackEntry = selectedEntry
    ? selectedEntry
    : {
        name:
          currentPath === '/'
            ? connectionName
            : (currentPath.split('/').filter(Boolean).at(-1) ?? connectionName),
        path: currentPath,
        isDirectory: true,
        size: null,
        mimeType: null,
        lastModified: null,
        color: null,
        icon: null,
        access: currentAccess ?? 'viewer',
      }

  const statQuery = useQuery(
    trpc.files.stat.queryOptions(
      { connectionId, path: inspectedPath },
      {
        enabled: Boolean(inspectedPath),
      },
    ),
  )
  const accessQuery = useQuery(
    trpc.permissions.getMyAccess.queryOptions(
      { connectionId, path: inspectedPath },
      {
        enabled: Boolean(inspectedPath),
      },
    ),
  )
  const tagsQuery = useQuery(
    trpc.tags.listForFiles.queryOptions(
      {
        connectionId,
        paths: [inspectedPath],
      },
      {
        enabled: Boolean(inspectedPath),
      },
    ),
  )

  const entry = {
    ...fallbackEntry,
    ...(statQuery.data ?? {}),
    color: fallbackEntry.color,
    icon: fallbackEntry.icon,
  }
  const tags = tagsQuery.data?.[inspectedPath] ?? []
  const access = accessQuery.data?.access ?? fallbackEntry.access
  const showImage = !entry.isDirectory && isImageEntry(entry)

  return (
    <section
      className={cn(
        'border-border/70 bg-card/88 supports-[backdrop-filter]:bg-card/74 flex h-full min-h-[28rem] flex-col overflow-hidden rounded-sm border supports-[backdrop-filter]:backdrop-blur-xl',
        className,
      )}
    >
      <div className="border-border/70 flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-foreground text-sm font-semibold">
            {isCurrentLocation ? 'Current folder' : 'Selected item'}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-sm"
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-5 py-5">
        <div className="bg-muted/35 border-border/70 mb-5 rounded-sm border p-4">
          <div className="flex items-start gap-3">
            <div
              className="text-primary flex size-14 shrink-0 items-center justify-center"
              style={getPaletteIconBadgeStyle(entry.color)}
            >
              {showImage ? (
                <img
                  src={buildInlinePreviewUrl(connectionId, inspectedPath)}
                  alt=""
                  className="size-full rounded-sm object-cover"
                />
              ) : entry.isDirectory ? (
                <DynamicIcon
                  value={entry.icon}
                  fallback={<FolderIcon className="size-6" strokeWidth={1.8} />}
                  className="size-6"
                />
              ) : (
                <PreviewKindIcon entry={entry} className="size-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-foreground min-w-0 truncate text-base font-semibold">
                  {entry.name}
                </h3>
                {isCurrentLocation ? (
                  <Badge variant="secondary">Current location</Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {typeLabel(entry)}
              </p>
              {tagsQuery.isLoading ? (
                <div className="mt-3 flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-sm" />
                  <Skeleton className="h-5 w-12 rounded-sm" />
                </div>
              ) : tags.length > 0 ? (
                <div className="mt-3">
                  <TagBadges tags={tags} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Info className="text-muted-foreground size-4" />
              <h4 className="text-foreground text-sm font-semibold">
                Overview
              </h4>
            </div>
            <dl className="space-y-3 text-sm">
              <InfoRow
                label="Connection"
                value={connectionName}
                icon={<HardDrive className="size-4" />}
              />
              <InfoRow
                label="Path"
                value={inspectedPath}
                icon={<FolderIcon className="size-4" />}
                breakWords
              />
              <InfoRow
                label="Size"
                value={
                  entry.isDirectory
                    ? 'Folder size unavailable'
                    : formatBytes(entry.size)
                }
                icon={<FileIcon className="size-4" />}
              />
            </dl>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="text-muted-foreground size-4" />
              <h4 className="text-foreground text-sm font-semibold">Dates</h4>
            </div>
            <dl className="space-y-3 text-sm">
              <InfoRow
                label="Created"
                value="Unavailable from this storage backend"
                icon={<CalendarDays className="size-4" />}
              />
              <InfoRow
                label="Updated"
                value={
                  statQuery.isLoading
                    ? 'Loading…'
                    : formatDateTime(entry.lastModified)
                }
                icon={<CalendarDays className="size-4" />}
              />
            </dl>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Shield className="text-muted-foreground size-4" />
              <h4 className="text-foreground text-sm font-semibold">Access</h4>
            </div>
            <dl className="space-y-3 text-sm">
              <InfoRow
                label="Permission"
                value={accessQuery.isLoading ? 'Loading…' : accessLabel(access)}
                icon={<Shield className="size-4" />}
              />
              <InfoRow
                label="Tags"
                value={
                  tagsQuery.isLoading
                    ? 'Loading…'
                    : tags.length > 0
                      ? `${tags.length} applied`
                      : 'No tags applied'
                }
                icon={<Tag className="size-4" />}
              />
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}

function InfoRow({
  label,
  value,
  icon,
  breakWords = false,
}: {
  label: string
  value: string
  icon: ReactNode
  breakWords?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-muted/55 text-muted-foreground border-border/70 flex size-9 shrink-0 items-center justify-center rounded-sm border">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <dt className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
          {label}
        </dt>
        <dd
          className={cn(
            'text-foreground mt-1 text-sm leading-6',
            breakWords && 'break-all',
          )}
        >
          {value}
        </dd>
      </div>
    </div>
  )
}

export function FileInspector({
  open,
  onOpenChange,
  connectionId,
  connectionName,
  currentPath,
  currentAccess,
  selectedEntry,
}: FileInspectorProps) {
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setDesktop(media.matches)

    update()
    media.addEventListener('change', update)
    return () => {
      media.removeEventListener('change', update)
    }
  }, [])

  if (!open) {
    return null
  }

  return (
    <>
      <div className="hidden h-full lg:block">
        <InspectorSurface
          closeLabel="Hide details"
          connectionId={connectionId}
          connectionName={connectionName}
          currentPath={currentPath}
          currentAccess={currentAccess}
          selectedEntry={selectedEntry}
          onClose={() => onOpenChange(false)}
        />
      </div>

      <Dialog open={open && !desktop} onOpenChange={onOpenChange}>
        <DialogContent
          className="bg-card/80 supports-[backdrop-filter]:bg-card/70 w-full max-w-[calc(100%-1rem)] p-0 supports-[backdrop-filter]:backdrop-blur-xl lg:hidden"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>File details</DialogTitle>
            <p>Metadata and access information</p>
          </DialogHeader>
          <InspectorSurface
            closeLabel="Close details"
            connectionId={connectionId}
            connectionName={connectionName}
            currentPath={currentPath}
            currentAccess={currentAccess}
            selectedEntry={selectedEntry}
            onClose={() => onOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
