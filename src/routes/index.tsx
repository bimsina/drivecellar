import { AuthView } from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'

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

  return (
    <AppShell footer={false}>
      <main className="container mx-auto flex min-h-0 flex-1 flex-col px-4 py-4 md:px-6 md:py-6">
        {sessionPending ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
            Loading…
          </div>
        ) : !user ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 md:p-6">
            <div className="w-full max-w-[min(100%,24rem)]">
              <AuthView pathname="sign-in" />
            </div>
          </div>
        ) : orgsPending ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
            Loading…
          </div>
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
