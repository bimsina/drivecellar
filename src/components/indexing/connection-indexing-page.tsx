import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { LoaderCircle, RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AppLoading } from '#/components/app-loading'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { useTRPC } from '#/integrations/trpc/react'
import { authClient } from '#/lib/auth-client'

type ConnectionIndexingPageProps = {
  connectionId: string
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return '—'
  }

  return value.toLocaleString()
}

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let idx = 0

  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx += 1
  }

  return `${size.toFixed(size >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`
}

function formatElapsed(milliseconds: number) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return '0s'
  }

  const totalSeconds = Math.floor(milliseconds / 1_000)
  const hours = Math.floor(totalSeconds / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}

function badgeVariantForStatus(
  status: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'succeeded') {
    return 'default'
  }

  if (status === 'running') {
    return 'secondary'
  }

  if (status === 'failed') {
    return 'destructive'
  }

  return 'outline'
}

export function ConnectionIndexingPage({
  connectionId,
}: ConnectionIndexingPageProps) {
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { data: sessionData, isPending: sessionPending } =
    authClient.useSession()
  const activeOrganizationId = sessionData?.session.activeOrganizationId ?? null
  const [startRequested, setStartRequested] = useState(false)
  const [
    hasSeenIndexingForRequestedStart,
    setHasSeenIndexingForRequestedStart,
  ] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const roleQuery = useQuery(
    trpc.connections.getMyOrganizationRole.queryOptions(
      { organizationId: activeOrganizationId ?? '' },
      { enabled: Boolean(activeOrganizationId) },
    ),
  )

  const canManageConnections = roleQuery.data?.canManageConnections === true

  const connectionQuery = useQuery(
    trpc.connections.getById.queryOptions(
      { id: connectionId },
      { enabled: Boolean(connectionId) && canManageConnections },
    ),
  )

  const statusQuery = useQuery(
    trpc.indexing.status.queryOptions(
      { connectionId },
      {
        enabled: Boolean(connectionId) && canManageConnections,
        refetchInterval: (query) =>
          query.state.data?.status === 'indexing' ? 2_000 : false,
      },
    ),
  )

  const runsQuery = useQuery(
    trpc.indexing.runs.queryOptions(
      { connectionId, limit: 200 },
      {
        enabled: Boolean(connectionId) && canManageConnections,
        refetchInterval: () =>
          statusQuery.data?.status === 'indexing' ? 2_000 : false,
      },
    ),
  )
  const indexedCountQuery = useQuery(
    trpc.indexing.indexedCount.queryOptions(
      { connectionId },
      {
        enabled: Boolean(connectionId) && canManageConnections,
        refetchInterval: () =>
          statusQuery.data?.status === 'indexing' ? 2_000 : false,
      },
    ),
  )

  const startMutation = useMutation(
    trpc.indexing.start.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(
            trpc.indexing.status.queryFilter({ connectionId }),
          ),
          queryClient.invalidateQueries(
            trpc.indexing.indexedCount.queryFilter({ connectionId }),
          ),
          queryClient.invalidateQueries(
            trpc.indexing.runs.queryFilter({ connectionId, limit: 200 }),
          ),
        ])
      },
    }),
  )

  const cancelMutation = useMutation(
    trpc.indexing.cancel.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries(
            trpc.indexing.status.queryFilter({ connectionId }),
          ),
          queryClient.invalidateQueries(
            trpc.indexing.indexedCount.queryFilter({ connectionId }),
          ),
          queryClient.invalidateQueries(
            trpc.indexing.runs.queryFilter({ connectionId, limit: 200 }),
          ),
        ])
      },
    }),
  )

  const status = statusQuery.data
  const isIndexing = status?.status === 'indexing'
  const runningRun = (runsQuery.data ?? []).find(
    (run) => run.status === 'running',
  )
  const liveIndexedCount = isIndexing
    ? Math.max(
        status?.indexedCount ?? 0,
        indexedCountQuery.data?.indexedCount ?? 0,
        runningRun?.indexedCount ?? 0,
      )
    : (status?.indexedCount ?? 0)
  const startDisabled =
    isIndexing ||
    startMutation.isPending ||
    startRequested ||
    cancelMutation.isPending
  const isBusy = startMutation.isPending || cancelMutation.isPending

  useEffect(() => {
    if (!isIndexing) {
      return
    }

    setNow(Date.now())
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [isIndexing])

  useEffect(() => {
    if (!startRequested) {
      return
    }

    if (isIndexing) {
      if (!hasSeenIndexingForRequestedStart) {
        setHasSeenIndexingForRequestedStart(true)
      }
      return
    }

    if (hasSeenIndexingForRequestedStart) {
      setStartRequested(false)
      setHasSeenIndexingForRequestedStart(false)
    }
  }, [hasSeenIndexingForRequestedStart, isIndexing, startRequested])

  async function handleStart() {
    setStartRequested(true)
    setHasSeenIndexingForRequestedStart(false)

    try {
      await startMutation.mutateAsync({ connectionId })
      toast.success('Indexing started.')
    } catch (error) {
      setStartRequested(false)
      setHasSeenIndexingForRequestedStart(false)

      const code =
        typeof error === 'object' &&
        error !== null &&
        'data' in error &&
        typeof (error as { data?: unknown }).data === 'object'
          ? ((error as { data?: { code?: string } }).data?.code ?? null)
          : null

      if (code === 'CONFLICT') {
        toast.message(
          'Indexing is already running. Tracking live progress below.',
        )
        return
      }

      toast.error(
        error instanceof Error ? error.message : 'Failed to start indexing.',
      )
    }
  }

  async function handleCancel() {
    try {
      const result = await cancelMutation.mutateAsync({ connectionId })
      if (result.cancelled) {
        toast.success('Indexing canceled.')
      } else {
        toast.message('No active indexing job found.')
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to cancel indexing.',
      )
    }
  }

  if (
    sessionPending ||
    roleQuery.isPending ||
    (canManageConnections && connectionQuery.isPending)
  ) {
    return (
      <main className="flex min-h-0 flex-1 flex-col">
        <AppLoading label="Loading indexing workspace…" />
      </main>
    )
  }

  if (!activeOrganizationId) {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <p className="text-muted-foreground text-sm">
          Select an active team to manage indexing.
        </p>
      </main>
    )
  }

  if (!canManageConnections) {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center">
        <p className="text-foreground text-sm font-medium">
          Only owners and admins can access indexing management.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigate({ to: '/' })
          }}
        >
          Back to connections
        </Button>
      </main>
    )
  }

  if (connectionQuery.isError || !connectionQuery.data) {
    return (
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center">
        <p className="text-destructive text-sm">
          {connectionQuery.error?.message ?? 'Connection not found.'}
        </p>
      </main>
    )
  }

  const connection = connectionQuery.data

  return (
    <main className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-foreground text-lg font-medium">Indexing</h1>
          <p className="text-muted-foreground text-sm">{connection.name}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild type="button" variant="outline">
            <Link
              to="/c/$id"
              params={{ id: connection.id }}
              search={{ file: '/' }}
            >
              Open files
            </Link>
          </Button>
          {isIndexing ? (
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => {
                void handleCancel()
              }}
            >
              Cancel run
            </Button>
          ) : (
            <Button
              type="button"
              disabled={startDisabled}
              onClick={() => {
                void handleStart()
              }}
            >
              {startMutation.isPending ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 size-4" />
              )}
              Re-index now
            </Button>
          )}
        </div>
      </div>

      {isIndexing ? (
        <Card>
          <CardHeader>
            <CardTitle>Active run progress</CardTitle>
            <CardDescription>
              Indexing is running in the background. You can leave this page and
              return anytime.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">Processed entries</p>
              <p className="text-foreground text-base font-medium">
                {formatCount(liveIndexedCount)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Started</p>
              <p>{formatDateTime(runningRun?.startedAt ?? null)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Elapsed</p>
              <p>
                {runningRun
                  ? formatElapsed(now - runningRun.startedAt.getTime())
                  : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Current status</CardTitle>
          <CardDescription>
            Monitor active progress and last successful sync details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                status?.status === 'failed' ? 'destructive' : 'secondary'
              }
            >
              {status?.status ?? 'idle'}
            </Badge>
            {isIndexing ? (
              <span className="text-muted-foreground text-sm">
                Indexing in progress...
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs">
                Last successful sync
              </p>
              <p>{formatDateTime(status?.lastIndexedAt ?? null)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Indexed entries</p>
              <p>{formatCount(liveIndexedCount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Files</p>
              <p>{formatCount(status?.totalFiles ?? 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Folders</p>
              <p>{formatCount(status?.totalFolders ?? 0)}</p>
            </div>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground text-xs">Total indexed size</p>
            <p>{formatSize(status?.totalSize ?? 0)}</p>
          </div>
          {status?.errorMessage ? (
            <p className="text-destructive text-sm">{status.errorMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Index runs</CardTitle>
          <CardDescription>
            Full run history for this connection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runsQuery.isError ? (
            <p className="text-destructive text-sm">
              {runsQuery.error.message ?? 'Could not load index runs.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead>Entries</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead>Folders</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(runsQuery.data ?? []).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Badge variant={badgeVariantForStatus(run.status)}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{run.trigger}</TableCell>
                    <TableCell>{formatDateTime(run.startedAt)}</TableCell>
                    <TableCell>{formatDateTime(run.finishedAt)}</TableCell>
                    <TableCell>
                      {formatCount(
                        run.status === 'running'
                          ? liveIndexedCount
                          : run.indexedCount,
                      )}
                    </TableCell>
                    <TableCell>{formatCount(run.totalFiles)}</TableCell>
                    <TableCell>{formatCount(run.totalFolders)}</TableCell>
                    <TableCell>{formatSize(run.totalSize)}</TableCell>
                    <TableCell
                      className="max-w-80 truncate"
                      title={run.errorMessage ?? ''}
                    >
                      {run.errorMessage ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {runsQuery.data && runsQuery.data.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-muted-foreground py-6 text-center"
                    >
                      No indexing runs yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
