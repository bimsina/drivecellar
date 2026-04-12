import {
  AlertCircle,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  LoaderCircle,
  X,
} from 'lucide-react'

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
      return <LoaderCircle className="text-primary size-3.5 animate-spin" />
    case 'success':
      return <CheckCircle2 className="size-3.5 text-emerald-500" />
    case 'error':
      return <AlertCircle className="text-destructive size-3.5" />
    default:
      return <div className="bg-muted-foreground/45 size-2 rounded-full" />
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
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 w-[min(24rem,calc(100vw-1.5rem))]">
      <div className="border-border/70 bg-background/92 pointer-events-auto overflow-hidden rounded-2xl border shadow-sm backdrop-blur-xl">
        <button
          type="button"
          className="w-full px-3.5 py-3 text-left"
          onClick={() => onExpandedChange(!expanded)}
        >
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              {summary.failed > 0 ? (
                <AlertCircle className="text-destructive size-4" />
              ) : summary.isFinished ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <LoaderCircle className="text-primary size-4 animate-spin" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">
                    {heading}
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    {subheading}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {summary.isFinished ? (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground h-7 w-7 rounded-full"
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

              <div className="bg-muted mt-2 h-1 overflow-hidden rounded-full">
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
          <div className="border-border/60 border-t px-3 pb-2.5">
            <div className="max-h-64 overflow-y-auto">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="border-border/50 flex items-start gap-2 border-b py-2.5 last:border-b-0"
                >
                  <div className="mt-0.5 shrink-0">{statusIcon(upload)}</div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm">
                          {getUploadLabel(upload)}
                        </p>
                        <p className="text-muted-foreground truncate text-[11px]">
                          {upload.status === 'error'
                            ? (upload.error ?? 'Upload failed.')
                            : upload.renamed
                              ? `${upload.resolvedPath ?? upload.targetPath} renamed`
                              : (upload.resolvedPath ?? upload.targetPath)}
                        </p>
                      </div>

                      {upload.status === 'success' ||
                      upload.status === 'error' ? (
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground h-7 w-7 shrink-0 rounded-full"
                          onClick={() => onRemoveUpload(upload.id)}
                          aria-label={`Remove ${getUploadLabel(upload)} from queue`}
                        >
                          <X className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-2 flex items-center gap-2.5">
                      <div className="bg-muted h-1 flex-1 overflow-hidden rounded-full">
                        <div
                          className={cn(
                            'h-full rounded-full transition-[width] duration-200',
                            progressBarClass(upload),
                          )}
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground w-9 text-right text-[11px] tabular-nums">
                        {Math.round(upload.progress)}%
                      </span>
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
