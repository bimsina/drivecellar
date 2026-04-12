import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'

import { AppLoading } from '#/components/app-loading'
import { AppShell } from '#/components/app-shell'
import { FileExplorer } from '#/components/file-explorer/file-explorer'
import { useTRPC } from '#/integrations/trpc/react'
import { getExplorerRouteTarget } from '#/lib/explorer-route'

type ExplorerPageProps = {
  connectionId: string
  path: string
}

export function ExplorerPage({ connectionId, path }: ExplorerPageProps) {
  const navigate = useNavigate()
  const { file } = useSearch({ from: '/c/$id' })
  const trpc = useTRPC()

  const connectionQuery = useQuery(
    trpc.connections.getById.queryOptions(
      { id: connectionId },
      { enabled: Boolean(connectionId) },
    ),
  )

  function handlePathChange(nextPath: string) {
    void navigate({
      ...getExplorerRouteTarget(connectionId, nextPath),
      search: (prev) => ({ ...prev, file: undefined }),
      replace: true,
    })
  }

  function handleSelectedFilePathChange(
    nextFilePath: string | null,
    options?: { replace?: boolean },
  ) {
    void navigate({
      ...getExplorerRouteTarget(connectionId, path),
      search: (prev) => ({
        ...prev,
        file: nextFilePath ?? undefined,
      }),
      replace: options?.replace ?? false,
    })
  }

  return (
    <AppShell variant="wide">
      <main className="flex min-h-0 flex-1 flex-col">
        {connectionQuery.isPending ? (
          <AppLoading label="Loading storage…" />
        ) : connectionQuery.isError || !connectionQuery.data ? (
          <div className="text-destructive flex flex-1 flex-col items-center justify-center px-4 py-12 text-center text-sm">
            {connectionQuery.error?.message ?? 'Connection not found.'}
          </div>
        ) : (
          <FileExplorer
            connectionId={connectionQuery.data.id}
            connectionName={connectionQuery.data.name}
            path={path}
            onPathChange={handlePathChange}
            selectedFilePath={file}
            onSelectedFilePathChange={handleSelectedFilePathChange}
          />
        )}
      </main>
    </AppShell>
  )
}
