import { AuthView } from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'

import { AppLoading } from '#/components/app-loading'
import { AppShell } from '#/components/app-shell'
import { ConnectionsFeature } from '#/components/connections/connections-feature'
import { OrganizationOnboardingCard } from '#/components/home/organization-onboarding-card'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const {
    data: organizations,
    isPending: orgsPending,
    refetch: refetchOrganizations,
  } = authClient.useListOrganizations()
  const user = session?.user
  const hasOrgs = (organizations?.length ?? 0) > 0
  const activeOrganizationId = session?.session.activeOrganizationId ?? null

  const isBootstrapping = sessionPending || (!!user && orgsPending)
  const wideShell = Boolean(user) && !sessionPending && !orgsPending && hasOrgs

  /** Flat header during bootstrap so the default card chrome does not flash. */
  const shellVariant = wideShell ? 'wide' : isBootstrapping ? 'wide' : 'default'

  return (
    <AppShell variant={shellVariant}>
      <main className="flex min-h-0 flex-1 flex-col">
        {sessionPending ? (
          <AppLoading label="Loading session…" />
        ) : !user ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 md:p-6">
            <div className="w-full max-w-[min(100%,24rem)]">
              <AuthView pathname="sign-in" />
            </div>
          </div>
        ) : orgsPending ? (
          <AppLoading label="Loading workspace…" />
        ) : !hasOrgs ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-6">
            <OrganizationOnboardingCard onCreated={refetchOrganizations} />
          </div>
        ) : (
          <ConnectionsFeature activeOrganizationId={activeOrganizationId} />
        )}
      </main>
    </AppShell>
  )
}
