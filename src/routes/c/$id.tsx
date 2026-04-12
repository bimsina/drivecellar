import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { AppLoading } from '#/components/app-loading'
import { AppShell } from '#/components/app-shell'
import { FileExplorer } from '#/components/file-explorer/file-explorer'
import { useTRPC } from '#/integrations/trpc/react'
import { normalizePath, PathError } from '#/lib/storage/path-utils'

export const Route = createFileRoute('/c/$id')({
  validateSearch: (search: Record<string, unknown>) => {
    const raw = typeof search.path === 'string' ? search.path : '/'
    try {
      return { path: normalizePath(raw) }
    } catch (e) {
      if (e instanceof PathError) {
        return { path: '/' }
      }
      throw e
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()
  const { path } = Route.useSearch()
  const navigate = Route.useNavigate()
  const trpc = useTRPC()

  const connectionQuery = useQuery(
    trpc.connections.getById.queryOptions({ id }, { enabled: Boolean(id) }),
  )

  function handlePathChange(next: string) {
    void navigate({
      to: '/c/$id',
      params: { id },
      search: { path: next },
      replace: true,
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
          />
        )}
      </main>
    </AppShell>
  )
}
