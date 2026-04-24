import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Separator } from '#/components/ui/separator'
import type { FileEntry } from '#/lib/storage/types'
import { cn } from '#/lib/utils'

import { NativeFilePreview } from './native-file-preview'
import { buildDownloadUrl, buildInlinePreviewUrl } from './preview-utils'

function formatBytes(n: number | null) {
  if (n === null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(d: Date | null) {
  if (!d) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return d.toString()
  }
}

type FilePreviewProps = {
  connectionId: string
  entry: FileEntry | null
  className?: string
}

export function FilePreview({
  connectionId,
  entry,
  className,
}: FilePreviewProps) {
  if (!entry || entry.isDirectory) {
    return (
      <aside
        className={cn(
          'border-border bg-card flex w-full min-w-[min(100%,18rem)] flex-col gap-4 rounded-sm border p-4 text-sm lg:w-[20rem]',
          className,
        )}
      >
        <p className="text-muted-foreground text-sm">No file selected</p>
      </aside>
    )
  }

  const downloadUrl = buildDownloadUrl(connectionId, entry.path)
  const previewUrl = buildInlinePreviewUrl(connectionId, entry.path)

  return (
    <aside
      className={cn(
        'border-border bg-card flex w-full min-w-[min(100%,18rem)] flex-col gap-4 rounded-sm border p-4 lg:w-[20rem]',
        className,
      )}
    >
      <p className="text-foreground text-sm font-medium">Details</p>

      <div className="border-border relative aspect-[4/3] w-full overflow-hidden rounded-sm border bg-[#f8f9fa] dark:bg-white/5">
        <NativeFilePreview
          entry={entry}
          previewUrl={previewUrl}
          downloadUrl={downloadUrl}
          compact
          showDownloadAction={false}
        />
      </div>

      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="p-0 pb-2">
          <CardTitle className="text-foreground text-base leading-snug break-all">
            {entry.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 p-0 text-xs">
          <div className="flex justify-between gap-2">
            <span className="shrink-0">Size</span>
            <span className="text-foreground text-right">
              {formatBytes(entry.size)}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between gap-2">
            <span className="shrink-0">Type</span>
            <span className="text-foreground max-w-48 truncate text-right">
              {entry.mimeType ?? 'Unknown'}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between gap-2">
            <span className="shrink-0">Modified</span>
            <span className="text-foreground text-right">
              {formatDate(entry.lastModified)}
            </span>
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-2">
            <span className="shrink-0">Path</span>
            <span className="text-foreground text-right text-[11px] leading-relaxed break-all">
              {entry.path}
            </span>
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}
