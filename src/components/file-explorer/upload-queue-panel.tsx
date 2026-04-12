import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileIcon,
  LoaderCircle,
  X,
} from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

import type { QueuedUpload } from './upload-types'
import { getUploadLabel, summarizeUploads } from './upload-utils'

type UploadQueuePanelProps = {
  uploads: QueuedUpload[]
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onDismissComplete: () => void
  onRemoveUpload: (id: string) => void
}

function statusIcon(upload: QueuedUpload) {
  switch (upload.status) {
    case 'uploading':
      return <LoaderCircle className="text-primary size-4 animate-spin" />
    case 'success':
      return <CheckCircle2 className="text-chart-4 size-4" />
    case 'error':
      return <AlertCircle className="text-destructive size-4" />
    default:
      return <FileIcon className="text-muted-foreground size-4" />
  }
}

function progressBarClass(upload: QueuedUpload) {
  if (upload.status === 'error') {
    return 'bg-destructive/80'
  }
  if (upload.status === 'success') {
    return 'bg-chart-4'
  }
  return 'bg-primary'
}

export function UploadQueuePanel({
  uploads,
  expanded,
  onExpandedChange,
  onDismissComplete,
  onRemoveUpload,
}: UploadQueuePanelProps) {
  const summary = summarizeUploads(uploads)

  if (uploads.length === 0) {
    return null
  }

  const heading = summary.isFinished
    ? summary.failed > 0
      ? 'Uploads finished with issues'
      : 'Uploads complete'
    : summary.active > 0
      ? `Uploading ${summary.active} item${summary.active === 1 ? '' : 's'}`
      : `Queued ${summary.queued} item${summary.queued === 1 ? '' : 's'}`

  const subheading =
    summary.failed > 0
      ? `${summary.success} done, ${summary.failed} failed`
      : `${summary.completed} of ${summary.total} complete`

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 w-[min(26rem,calc(100vw-2rem))]">
      <div className="border-border bg-card pointer-events-auto overflow-hidden rounded-[1.4rem] border shadow-lg backdrop-blur-xl">
        <button
          type="button"
          className="w-full px-4 py-4 text-left"
          onClick={() => onExpandedChange(!expanded)}
        >
          <div className="flex items-start gap-3">
            <div className="bg-muted text-foreground mt-0.5 rounded-full p-2">
              {summary.failed > 0 ? (
                <AlertCircle className="size-4" />
              ) : summary.isFinished ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <LoaderCircle className="size-4 animate-spin" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-semibold">
                    {heading}
                  </p>
                  <p className="text-muted-foreground text-xs">{subheading}</p>
                </div>
                <div className="flex items-center gap-2">
                  {summary.isFinished ? (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={(event) => {
                        event.stopPropagation()
                        onDismissComplete()
                      }}
                      aria-label="Dismiss upload queue"
                    >
                      <X className="size-3.5" />
                    </Button>
                  ) : null}
                  {expanded ? (
                    <ChevronDown className="text-muted-foreground size-4" />
                  ) : (
                    <ChevronUp className="text-muted-foreground size-4" />
                  )}
                </div>
              </div>

              <div className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-300',
                    summary.failed > 0 ? 'bg-destructive/70' : 'bg-primary',
                  )}
                  style={{ width: `${summary.averageProgress}%` }}
                />
              </div>
            </div>
          </div>
        </button>

        {expanded ? (
          <div className="border-border bg-muted/40 border-t px-3 py-3">
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="border-border bg-card rounded-2xl border px-3 py-2 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 shrink-0">{statusIcon(upload)}</div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-foreground truncate text-sm font-medium">
                            {getUploadLabel(upload)}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {upload.status === 'error'
                              ? (upload.error ?? 'Upload failed.')
                              : (upload.resolvedPath ?? upload.targetPath)}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {upload.renamed ? (
                            <Badge
                              variant="outline"
                              className="border-border bg-muted text-foreground"
                            >
                              Renamed
                            </Badge>
                          ) : null}
                          {upload.status === 'success' ||
                          upload.status === 'error' ? (
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              className="text-muted-foreground"
                              onClick={() => onRemoveUpload(upload.id)}
                              aria-label={`Remove ${getUploadLabel(upload)} from queue`}
                            >
                              <X className="size-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-3">
                        <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width] duration-200',
                              progressBarClass(upload),
                            )}
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground w-10 text-right text-[11px] font-medium tabular-nums">
                          {Math.round(upload.progress)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
