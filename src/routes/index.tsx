import { AuthView } from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'

import { AppLoading } from '#/components/app-loading'
import { AppShell } from '#/components/app-shell'
import { ConnectionsFeature } from '#/components/connections/connections-feature'
import {
  getHomeBootstrapState,
  useOrganizationBootstrap,
} from '#/components/home/organization-bootstrap'
import { OrganizationChoiceCard } from '#/components/home/organization-choice-card'
import { OrganizationBootstrapRecoveryCard } from '#/components/home/organization-bootstrap-recovery-card'
import { OrganizationOnboardingCard } from '#/components/home/organization-onboarding-card'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  const {
    data: session,
    isPending: sessionPending,
    error: sessionError,
    refetch: refetchSession,
  } = authClient.useSession()
  const user = session?.user ?? null
  const activeOrganizationId = session?.session.activeOrganizationId ?? null

  if (!user) {
    return (
      <AppShell showHeader={false}>
        <main className="flex min-h-0 flex-1 flex-col">
          {sessionPending ? (
            <AppLoading label="Loading session…" />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 md:p-6">
              <div className="w-full max-w-[min(100%,24rem)]">
                <AuthView pathname="sign-in" />
              </div>
            </div>
          )}
        </main>
      </AppShell>
    )
  }

  return (
    <AuthenticatedHomePage
      activeOrganizationId={activeOrganizationId}
      refetchSession={refetchSession}
      sessionError={sessionError}
      sessionPending={sessionPending}
      user={user}
    />
  )
}

type AuthenticatedHomePageProps = {
  activeOrganizationId: string | null
  refetchSession: (() => Promise<unknown> | unknown) | undefined
  sessionError: unknown
  sessionPending: boolean
  user: {
    id: string
  }
}

function AuthenticatedHomePage({
  activeOrganizationId,
  refetchSession,
  sessionError,
  sessionPending,
  user,
}: AuthenticatedHomePageProps) {
  const {
    data: organizations,
    isPending: orgsPending,
    error: organizationsError,
    refetch: refetchOrganizations,
  } = authClient.useListOrganizations()

  const {
    bootstrapPhase,
    bootstrapLoadError,
    fallbackMessage,
    isSelectingOrganization,
    pendingOrganizationId,
    selectionError,
    selectOrganization,
    retryAutoSelection,
  } = useOrganizationBootstrap({
    user,
    organizations,
    activeOrganizationId,
    refetchOrganizations,
    refetchSession,
  })

  const homeState = getHomeBootstrapState({
    hasUser: Boolean(user),
    sessionPending,
    orgsPending,
    sessionError,
    organizations,
    organizationsError,
    activeOrganizationId,
    bootstrapPhase,
    bootstrapLoadError,
  })

  const hasOrgs = (organizations?.length ?? 0) > 0
  const isBootstrapping =
    homeState === 'bootstrapping_session_or_orgs' ||
    homeState === 'auto_selecting_org'
  const wideShell = Boolean(user) && (hasOrgs || isBootstrapping)
  const bootstrapErrorMessage =
    (sessionError instanceof Error ? sessionError.message : null) ??
    bootstrapLoadError ??
    (organizationsError instanceof Error
      ? organizationsError.message
      : 'We could not load your teams yet. Please try again.')

  const refreshBootstrapData = useCallback(async () => {
    await Promise.allSettled([
      Promise.resolve(refetchSession?.()),
      Promise.resolve(refetchOrganizations?.()),
    ])
  }, [refetchOrganizations, refetchSession])

  const handleRetryLoad = useCallback(async () => {
    await refreshBootstrapData()
  }, [refreshBootstrapData])

  const handleRetryAutoSelection = useCallback(async () => {
    await refreshBootstrapData()
    retryAutoSelection()
  }, [refreshBootstrapData, retryAutoSelection])

  const handleOrganizationCreated = useCallback(async () => {
    await refreshBootstrapData()
  }, [refreshBootstrapData])

  /** Flat header during bootstrap so the default card chrome does not flash. */
  const shellVariant = wideShell ? 'wide' : isBootstrapping ? 'wide' : 'default'

  return (
    <AppShell variant={shellVariant}>
      <main className="flex min-h-0 flex-1 flex-col">
        {homeState === 'signed_out' ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 md:p-6">
            <div className="w-full max-w-[min(100%,24rem)]">
              <AuthView pathname="sign-in" />
            </div>
          </div>
        ) : homeState === 'bootstrapping_session_or_orgs' ||
          homeState === 'auto_selecting_org' ? (
          <AppLoading
            label={user ? 'Opening your team…' : 'Loading session…'}
          />
        ) : homeState === 'org_query_error' ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-6">
            <OrganizationBootstrapRecoveryCard
              errorMessage={bootstrapErrorMessage}
              isRetrying={sessionPending || orgsPending}
              onRetry={handleRetryLoad}
            />
          </div>
        ) : homeState === 'no_orgs_after_successful_load' ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-6">
            <OrganizationOnboardingCard onCreated={handleOrganizationCreated} />
          </div>
        ) : homeState === 'choose_team_fallback' ? (
          <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-6">
            <div className="space-y-4">
              <OrganizationChoiceCard
                organizations={organizations ?? []}
                errorMessage={selectionError}
                helperMessage={fallbackMessage}
                isSubmitting={isSelectingOrganization}
                pendingOrganizationId={pendingOrganizationId}
                onSelect={selectOrganization}
              />
              <div className="flex justify-center">
                <button
                  className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 transition hover:underline"
                  onClick={() => void handleRetryAutoSelection()}
                  type="button"
                >
                  Try automatic team selection again
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ConnectionsFeature activeOrganizationId={activeOrganizationId} />
        )}
      </main>
    </AppShell>
  )
}
