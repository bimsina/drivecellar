import {
  Download,
  FileAudio,
  FileIcon,
  FileText,
  FileVideo,
  Loader2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import type { FileEntry } from '#/lib/storage/types'
import { cn } from '#/lib/utils'

import { getPreviewKind } from './preview-utils'

type NativeFilePreviewProps = {
  entry: FileEntry
  previewUrl: string
  downloadUrl: string
  className?: string
  compact?: boolean
  showDownloadAction?: boolean
}

function UnsupportedPreview({
  entry,
  downloadUrl,
  compact,
  showDownloadAction,
}: {
  entry: FileEntry
  downloadUrl: string
  compact: boolean
  showDownloadAction: boolean
}) {
  return (
    <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
      <FileIcon
        className={cn(compact ? 'size-10' : 'size-16', 'opacity-40')}
        strokeWidth={1.25}
      />
      <p className={cn('max-w-sm', compact ? 'text-xs' : 'text-sm')}>
        No inline preview for this file type yet.
      </p>
      {showDownloadAction ? (
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <a href={downloadUrl} download={entry.name}>
            <Download className="size-4" />
            Download
          </a>
        </Button>
      ) : null}
    </div>
  )
}

export function NativeFilePreview({
  entry,
  previewUrl,
  downloadUrl,
  className,
  compact = false,
  showDownloadAction = true,
}: NativeFilePreviewProps) {
  const [textBody, setTextBody] = useState<string | null>(null)
  const [textError, setTextError] = useState<string | null>(null)
  const [textLoading, setTextLoading] = useState(false)
  const kind = getPreviewKind(entry)

  useEffect(() => {
    if (kind !== 'text') {
      setTextBody(null)
      setTextError(null)
      setTextLoading(false)
      return
    }

    setTextLoading(true)
    setTextBody(null)
    setTextError(null)

    let cancelled = false
    void fetch(previewUrl, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.statusText || 'Could not load file.')
        }
        return res.text()
      })
      .then((text) => {
        if (!cancelled) {
          setTextBody(text)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setTextError(
            error instanceof Error ? error.message : 'Could not load preview.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTextLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [kind, previewUrl])

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 overflow-hidden',
        compact
          ? 'items-stretch justify-stretch'
          : 'items-center justify-center',
        className,
      )}
    >
      {kind === 'image' ? (
        <div
          className={cn(
            'flex size-full items-center justify-center overflow-auto',
            compact ? 'p-0' : 'p-4 sm:p-8',
          )}
        >
          <img
            src={previewUrl}
            alt=""
            className={cn(
              'max-h-full max-w-full object-contain',
              compact && 'size-full',
            )}
            loading="lazy"
          />
        </div>
      ) : kind === 'pdf' ? (
        <object
          data={previewUrl}
          type="application/pdf"
          title={entry.name}
          className="size-full border-0"
        >
          <UnsupportedPreview
            entry={entry}
            downloadUrl={downloadUrl}
            compact={compact}
            showDownloadAction={showDownloadAction}
          />
        </object>
      ) : kind === 'video' ? (
        <div
          className={cn(
            'flex size-full items-center justify-center',
            compact ? 'bg-black' : 'p-4 sm:p-8',
          )}
        >
          <video
            src={previewUrl}
            controls
            preload="metadata"
            className="max-h-full max-w-full"
          >
            <track kind="captions" />
          </video>
        </div>
      ) : kind === 'audio' ? (
        <div className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center">
          <FileAudio
            className={cn(
              'text-muted-foreground opacity-50',
              compact ? 'size-10' : 'size-16',
            )}
            strokeWidth={1.25}
          />
          <audio
            src={previewUrl}
            controls
            preload="metadata"
            className="w-full max-w-xl"
          />
        </div>
      ) : kind === 'text' ? (
        <div
          className={cn(
            'flex size-full min-h-0 flex-col overflow-auto',
            compact ? 'p-3' : 'p-4 sm:p-6',
          )}
        >
          {textLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading preview…
            </div>
          ) : textError ? (
            <p className="text-destructive text-sm">{textError}</p>
          ) : textBody != null ? (
            <pre
              className={cn(
                'text-foreground border-border bg-background min-h-0 flex-1 overflow-auto rounded-sm border leading-relaxed wrap-break-word whitespace-pre-wrap',
                compact ? 'p-3 text-[11px]' : 'p-4 text-xs sm:text-sm',
              )}
            >
              {textBody}
            </pre>
          ) : (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <FileText className="size-4" />
              Preview unavailable.
            </div>
          )}
        </div>
      ) : (
        <UnsupportedPreview
          entry={entry}
          downloadUrl={downloadUrl}
          compact={compact}
          showDownloadAction={showDownloadAction}
        />
      )}
    </div>
  )
}

export function PreviewKindIcon({
  entry,
  className,
}: {
  entry: FileEntry
  className?: string
}) {
  const kind = getPreviewKind(entry)

  if (kind === 'video')
    return <FileVideo className={cn('size-8', className)} strokeWidth={1.6} />
  if (kind === 'audio')
    return <FileAudio className={cn('size-8', className)} strokeWidth={1.6} />
  if (kind === 'text' || kind === 'pdf') {
    return <FileText className={cn('size-8', className)} strokeWidth={1.6} />
  }

  return <FileIcon className={cn('size-8', className)} strokeWidth={1.6} />
}
