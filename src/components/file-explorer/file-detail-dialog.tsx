import { Download, FileIcon, Loader2, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '#/components/ui/dialog'
import type { FileEntry } from '#/lib/storage/types'

import {
  buildDownloadUrl,
  isImageEntry,
  isTextPreviewable,
} from './preview-utils'

function formatBytes(n: number | null) {
  if (n === null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function fallbackNameForPath(path: string | null | undefined) {
  if (!path) {
    return 'File'
  }

  const parts = path.split('/').filter(Boolean)
  return parts.at(-1) ?? 'File'
}

type FileDetailDialogProps = {
  connectionId: string
  entry: FileEntry | null
  requestedPath?: string | null
  loading?: boolean
  errorMessage?: string | null
  canManagePermissions?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload: (entry: FileEntry) => void
  onManageAccess?: (target: { path: string; itemName: string }) => void
}

export function FileDetailDialog({
  connectionId,
  entry,
  requestedPath,
  loading = false,
  errorMessage = null,
  canManagePermissions = false,
  open,
  onOpenChange,
  onDownload,
  onManageAccess,
}: FileDetailDialogProps) {
  const [textBody, setTextBody] = useState<string | null>(null)
  const [textError, setTextError] = useState<string | null>(null)
  const [textLoading, setTextLoading] = useState(false)

  useEffect(() => {
    if (!open || !entry || entry.isDirectory) {
      setTextBody(null)
      setTextError(null)
      setTextLoading(false)
      return
    }

    if (!isTextPreviewable(entry)) {
      setTextBody(null)
      setTextError(null)
      setTextLoading(false)
      return
    }

    const url = buildDownloadUrl(connectionId, entry.path)
    setTextLoading(true)
    setTextBody(null)
    setTextError(null)

    let cancelled = false
    void fetch(url, { credentials: 'include' })
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
      .catch((e: unknown) => {
        if (!cancelled) {
          setTextError(
            e instanceof Error ? e.message : 'Could not load preview.',
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
  }, [open, connectionId, entry])

  if (!open) {
    return null
  }

  if (!entry || entry.isDirectory) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          fullscreen
          showCloseButton
          className="flex min-h-0 flex-col overflow-hidden pt-14"
        >
          <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 pt-1 pb-3 sm:pr-16">
            <div className="min-w-0 flex-1 pr-2">
              <DialogTitle className="text-left text-base leading-snug break-all sm:text-lg">
                {fallbackNameForPath(requestedPath)}
              </DialogTitle>
              <DialogDescription className="mt-1 text-left text-xs">
                {requestedPath ?? 'Loading file details'}
              </DialogDescription>
            </div>
          </div>

          <div className="bg-muted/30 flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden p-8">
            {loading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading file…
              </div>
            ) : (
              <div className="flex max-w-sm flex-col items-center gap-3 text-center">
                <FileIcon
                  className="text-muted-foreground size-16 opacity-40"
                  strokeWidth={1.25}
                />
                <p className="text-destructive text-sm">
                  {errorMessage ?? 'Could not load this file.'}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const src = buildDownloadUrl(connectionId, entry.path)
  const showImage = isImageEntry(entry)
  const showText = isTextPreviewable(entry)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        fullscreen
        showCloseButton
        className="flex min-h-0 flex-col overflow-hidden pt-14"
      >
        <div className="border-border flex shrink-0 flex-col gap-1 border-b px-4 pt-1 pb-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pr-16">
          <div className="min-w-0 flex-1 pr-2">
            <DialogTitle className="text-left text-base leading-snug break-all sm:text-lg">
              {entry.name}
            </DialogTitle>
            <DialogDescription className="mt-1 text-left text-xs">
              {formatBytes(entry.size)}
              {entry.mimeType ? ` · ${entry.mimeType}` : null}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canManagePermissions ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  onManageAccess?.({
                    path: entry.path,
                    itemName: entry.name,
                  })
                }}
              >
                <Shield className="size-4" />
                Manage access
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => onDownload(entry)}
            >
              <Download className="size-4" />
              Download
            </Button>
          </div>
        </div>

        <div className="bg-muted/30 flex min-h-0 flex-1 flex-col overflow-hidden">
          {showImage ? (
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
              <img
                src={src}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : showText ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 sm:p-6">
              {textLoading ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Loading preview…
                </div>
              ) : textError ? (
                <p className="text-destructive text-sm">{textError}</p>
              ) : textBody != null ? (
                <pre className="text-foreground border-border bg-background min-h-0 flex-1 overflow-auto rounded-md border p-4 text-xs leading-relaxed wrap-break-word whitespace-pre-wrap sm:text-sm">
                  {textBody}
                </pre>
              ) : null}
            </div>
          ) : (
            <div className="text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8">
              <FileIcon className="size-16 opacity-40" strokeWidth={1.25} />
              <p className="max-w-sm text-center text-sm">
                No preview for this file type yet. Use Download to open it on
                your device.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
