import { useQuery } from '@tanstack/react-query'
import {
  createFileRoute,
  Outlet,
  useNavigate,
  useParams,
} from '@tanstack/react-router'

import { AppLoading } from '#/components/app-loading'
import { AppShell } from '#/components/app-shell'
import { Button } from '#/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { useTRPC } from '#/integrations/trpc/react'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/indexing')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  const { cid } = useParams({ strict: false })
  const trpc = useTRPC()
  const { data: sessionData, isPending: sessionPending } =
    authClient.useSession()
  const activeOrganizationId = sessionData?.session.activeOrganizationId ?? null
  const selectedConnectionId = cid ?? ''

  const roleQuery = useQuery(
    trpc.connections.getMyOrganizationRole.queryOptions(
      { organizationId: activeOrganizationId ?? '' },
      { enabled: Boolean(activeOrganizationId) },
    ),
  )
  const canManageConnections = roleQuery.data?.canManageConnections === true

  const connectionsQuery = useQuery(
    trpc.connections.list.queryOptions(
      { organizationId: activeOrganizationId ?? '' },
      { enabled: Boolean(activeOrganizationId) && canManageConnections },
    ),
  )

  function goToIndexing(connectionId: string) {
    if (!connectionId) {
      return
    }

    void navigate({
      to: '/indexing/$cid',
      params: { cid: connectionId },
    })
  }

  if (sessionPending || roleQuery.isPending) {
    return (
      <AppShell variant="wide">
        <main className="flex min-h-0 flex-1 flex-col">
          <AppLoading label="Loading indexing workspace…" />
        </main>
      </AppShell>
    )
  }

  if (!activeOrganizationId) {
    return (
      <AppShell variant="wide">
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center">
          <p className="text-muted-foreground text-sm">
            Select an active team to manage indexing.
          </p>
        </main>
      </AppShell>
    )
  }

  if (!canManageConnections) {
    return (
      <AppShell variant="wide">
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
      </AppShell>
    )
  }

  const connections = connectionsQuery.data ?? []

  return (
    <AppShell variant="wide">
      <main className="mx-auto flex w-full max-w-[1400px] min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-foreground text-lg font-medium">Indexing</h1>
            <p className="text-muted-foreground text-sm">
              Pick a connection to open or switch indexing workspaces.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Select
              value={selectedConnectionId}
              onValueChange={(nextValue) => {
                goToIndexing(nextValue)
              }}
            >
              <SelectTrigger className="w-full sm:w-96">
                <SelectValue placeholder="Select a connection" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    {connection.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {connectionsQuery.isError ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <p className="text-destructive text-sm">
              {connectionsQuery.error.message ?? 'Could not load connections.'}
            </p>
          </div>
        ) : connections.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <p className="text-muted-foreground text-sm">
              No connections are available in this organization.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        )}
      </main>
    </AppShell>
  )
}
