import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AppLoading } from '#/components/app-loading'
import { AppShell } from '#/components/app-shell'
import { Button } from '#/components/ui/button'
import { useTRPC } from '#/integrations/trpc/react'
import type { FileEntry } from '#/lib/storage/types'
import { getExplorerRouteTarget } from '#/lib/explorer-route'
import { computeParentPath } from '#/lib/storage/path-utils'

import { FileDetailView } from './file-detail-view'
import { PathAccessDialog } from './path-access-dialog'
import { buildDownloadUrl } from './preview-utils'

type FileDetailPageProps = {
  connectionId: string
  filePath: string
}

export function FileDetailPage({
  connectionId,
  filePath,
}: FileDetailPageProps) {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const [manageAccessTarget, setManageAccessTarget] = useState<{
    path: string
    itemName: string
    isDirectory: boolean
  } | null>(null)

  const connectionQuery = useQuery(
    trpc.connections.getById.queryOptions(
      { id: connectionId },
      { enabled: Boolean(connectionId) },
    ),
  )

  const pathIsRoot = filePath === '/'

  const fileDetailQuery = useQuery(
    trpc.files.stat.queryOptions(
      { connectionId, path: filePath },
      { enabled: Boolean(connectionId) && !pathIsRoot },
    ),
  )

  const parentPath = computeParentPath(filePath)

  const myAccessQuery = useQuery(
    trpc.permissions.getMyAccess.queryOptions(
      { connectionId, path: parentPath },
      { enabled: Boolean(connectionId) },
    ),
  )

  const canManagePermissions =
    myAccessQuery.data?.organizationRole === 'owner' ||
    myAccessQuery.data?.organizationRole === 'admin'

  useEffect(() => {
    if (!fileDetailQuery.data) {
      return
    }
    if (fileDetailQuery.data.isDirectory) {
      void navigate({
        ...getExplorerRouteTarget(connectionId, filePath),
        replace: false,
      })
    }
  }, [connectionId, fileDetailQuery.data, filePath, navigate])

  function triggerDownload(entry: FileEntry) {
    const url = buildDownloadUrl(connectionId, entry.path)
    window.location.assign(url)
  }

  const backTarget = getExplorerRouteTarget(connectionId, parentPath)
  const backLabel =
    parentPath === '/'
      ? (connectionQuery.data?.name ?? 'Storage')
      : (parentPath.split('/').filter(Boolean).at(-1) ?? 'Folder')

  const loading =
    !pathIsRoot &&
    (fileDetailQuery.isPending || Boolean(fileDetailQuery.data?.isDirectory))
  const statData = fileDetailQuery.data

  const entry: FileEntry | null =
    statData && !statData.isDirectory ? statData : null

  const errorMessage = pathIsRoot
    ? 'Open a file from the explorer to view it here.'
    : fileDetailQuery.isError
      ? (fileDetailQuery.error?.message ?? 'Could not load file.')
      : null

  return (
    <AppShell variant="wide">
      <main className="flex min-h-0 flex-1 flex-col gap-3">
        {connectionQuery.isPending ? (
          <AppLoading label="Loading storage…" />
        ) : connectionQuery.isError || !connectionQuery.data ? (
          <div className="text-destructive flex flex-1 flex-col items-center justify-center px-4 py-12 text-center text-sm">
            {connectionQuery.error?.message ?? 'Connection not found.'}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-1.5"
                asChild
              >
                <Link {...backTarget}>
                  <ArrowLeft className="size-4 shrink-0" />
                  Back to {backLabel}
                </Link>
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <FileDetailView
                connectionId={connectionId}
                entry={pathIsRoot ? null : entry}
                requestedPath={filePath}
                loading={loading}
                errorMessage={errorMessage}
                canManagePermissions={canManagePermissions}
                onDownload={triggerDownload}
                onManageAccess={(target) => {
                  setManageAccessTarget({
                    path: target.path,
                    itemName: target.itemName,
                    isDirectory: false,
                  })
                }}
              />
            </div>

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
                onPermissionsChanged={() => {
                  void fileDetailQuery.refetch()
                  void myAccessQuery.refetch()
                }}
              />
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  )
}
