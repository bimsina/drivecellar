import { useEffect, useRef, useState } from 'react'

import { authClient } from '#/lib/auth-client'

type RefetchFn = (() => Promise<unknown> | unknown) | undefined

export type OrganizationSummary = {
  id: string
  name: string
  slug?: string | null
}

type SessionUser = {
  id: string
}

type SessionResponse = {
  session?: {
    activeOrganizationId?: string | null
  } | null
} | null

type BootstrapPhase = 'idle' | 'syncing' | 'activating' | 'fallback'

type HomeBootstrapStateInput = {
  hasUser: boolean
  sessionPending: boolean
  orgsPending: boolean
  sessionError: unknown
  organizations: OrganizationSummary[] | null | undefined
  organizationsError: unknown
  activeOrganizationId: string | null
  bootstrapPhase: BootstrapPhase
  bootstrapLoadError: string | null
}

export type HomeBootstrapState =
  | 'signed_out'
  | 'bootstrapping_session_or_orgs'
  | 'org_query_error'
  | 'no_orgs_after_successful_load'
  | 'auto_selecting_org'
  | 'choose_team_fallback'
  | 'has_active_org'

export function pickDefaultOrganizationId(
  organizations: OrganizationSummary[] | null | undefined,
) {
  return organizations?.[0]?.id ?? null
}

export function getHomeBootstrapState({
  hasUser,
  sessionPending,
  orgsPending,
  sessionError,
  organizations,
  organizationsError,
  activeOrganizationId,
  bootstrapPhase,
  bootstrapLoadError,
}: HomeBootstrapStateInput): HomeBootstrapState {
  if (sessionPending) {
    return 'bootstrapping_session_or_orgs'
  }

  if (!hasUser) {
    return 'signed_out'
  }

  if (activeOrganizationId) {
    return 'has_active_org'
  }

  if (orgsPending) {
    return 'bootstrapping_session_or_orgs'
  }

  if (
    sessionError ||
    organizationsError ||
    bootstrapLoadError ||
    organizations == null
  ) {
    return 'org_query_error'
  }

  if (organizations.length === 0) {
    return 'no_orgs_after_successful_load'
  }

  if (bootstrapPhase === 'fallback') {
    return 'choose_team_fallback'
  }

  return 'auto_selecting_org'
}

type UseOrganizationBootstrapOptions = {
  user: SessionUser | null
  organizations: OrganizationSummary[] | null | undefined
  activeOrganizationId: string | null
  refetchOrganizations?: RefetchFn
  refetchSession?: RefetchFn
}

type ActivationResult = {
  success: boolean
  failureKind?: 'load_error' | 'fallback'
  errorMessage?: string
}

async function readCurrentSession() {
  return (await authClient.getSession({
    fetchOptions: { throw: true, disableSignal: true },
  })) as SessionResponse
}

export function useOrganizationBootstrap({
  user,
  organizations,
  activeOrganizationId,
  refetchOrganizations,
  refetchSession,
}: UseOrganizationBootstrapOptions) {
  const [bootstrapPhase, setBootstrapPhase] = useState<BootstrapPhase>('idle')
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null)
  const [bootstrapLoadError, setBootstrapLoadError] = useState<string | null>(
    null,
  )
  const [isSelectingOrganization, setIsSelectingOrganization] = useState(false)
  const [pendingOrganizationId, setPendingOrganizationId] = useState<
    string | null
  >(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const lastBootstrapKeyRef = useRef<string | null>(null)

  const targetOrganizationId = pickDefaultOrganizationId(
    user && !activeOrganizationId ? organizations : null,
  )

  useEffect(() => {
    if (!user || !targetOrganizationId || activeOrganizationId) {
      setBootstrapPhase('idle')
      setFallbackMessage(null)
      setBootstrapLoadError(null)
      setSelectionError(null)
      setIsSelectingOrganization(false)
      setPendingOrganizationId(null)
      lastBootstrapKeyRef.current = null
    }
  }, [activeOrganizationId, targetOrganizationId, user])

  useEffect(() => {
    if (
      !user ||
      !organizations ||
      organizations.length === 0 ||
      activeOrganizationId
    ) {
      return
    }

    const bootstrapKey = `${user.id}:${targetOrganizationId}:${organizations.length}:${retryNonce}`
    if (lastBootstrapKeyRef.current === bootstrapKey) {
      return
    }

    lastBootstrapKeyRef.current = bootstrapKey

    let cancelled = false

    async function refreshVisibleState() {
      await Promise.allSettled([
        Promise.resolve(refetchSession?.()),
        Promise.resolve(refetchOrganizations?.()),
      ])
    }

    async function attemptAutoActivation(
      organizationId: string,
    ): Promise<ActivationResult> {
      setBootstrapPhase('syncing')

      try {
        await Promise.resolve(refetchSession?.())

        const syncedSession = await readCurrentSession()
        if (syncedSession?.session?.activeOrganizationId) {
          await Promise.resolve(refetchOrganizations?.())
          return { success: true }
        }
      } catch (error) {
        return {
          success: false,
          failureKind: 'load_error',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'We could not read your session yet.',
        }
      }

      setBootstrapPhase('activating')

      try {
        await authClient.organization.setActive({
          organizationId,
          fetchOptions: { throw: true },
        })
      } catch (error) {
        return {
          success: false,
          failureKind: 'fallback',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'We could not open a team automatically.',
        }
      }

      await refreshVisibleState()

      try {
        const confirmedSession = await readCurrentSession()
        if (confirmedSession?.session?.activeOrganizationId) {
          return { success: true }
        }
      } catch (error) {
        return {
          success: false,
          failureKind: 'load_error',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'We could not confirm your team session yet.',
        }
      }

      return {
        success: false,
        failureKind: 'fallback',
        errorMessage:
          'We could not confirm your team selection yet. Choose a team to continue.',
      }
    }

    async function bootstrapOrganizationSelection() {
      setBootstrapLoadError(null)

      const firstAttempt = await attemptAutoActivation(targetOrganizationId)
      if (firstAttempt.success) {
        if (!cancelled) {
          setBootstrapPhase('idle')
          setFallbackMessage(null)
        }
        return
      }

      const secondAttempt = await attemptAutoActivation(targetOrganizationId)
      if (secondAttempt.success) {
        if (!cancelled) {
          setBootstrapPhase('idle')
          setFallbackMessage(null)
        }
        return
      }

      if (cancelled) {
        return
      }

      if (
        firstAttempt.failureKind === 'load_error' &&
        secondAttempt.failureKind === 'load_error'
      ) {
        setBootstrapPhase('idle')
        setBootstrapLoadError(
          secondAttempt.errorMessage ??
            firstAttempt.errorMessage ??
            'We could not load your session yet.',
        )
        return
      }

      setBootstrapPhase('fallback')
      setFallbackMessage(
        secondAttempt.errorMessage ??
          firstAttempt.errorMessage ??
          'We could not open a team automatically. Choose one to continue.',
      )
    }

    void bootstrapOrganizationSelection()

    return () => {
      cancelled = true
    }
  }, [
    activeOrganizationId,
    organizations,
    refetchOrganizations,
    refetchSession,
    retryNonce,
    targetOrganizationId,
    user,
  ])

  async function selectOrganization(organizationId: string) {
    setSelectionError(null)
    setIsSelectingOrganization(true)
    setPendingOrganizationId(organizationId)

    try {
      await authClient.organization.setActive({
        organizationId,
        fetchOptions: { throw: true },
      })

      await Promise.allSettled([
        Promise.resolve(refetchSession?.()),
        Promise.resolve(refetchOrganizations?.()),
      ])

      const confirmedSession = await readCurrentSession()
      if (!confirmedSession?.session?.activeOrganizationId) {
        throw new Error('We could not enter that team yet. Please try again.')
      }

      setBootstrapPhase('idle')
      setFallbackMessage(null)
    } catch (error) {
      setSelectionError(
        error instanceof Error
          ? error.message
          : 'We could not enter that team yet. Please try again.',
      )
    } finally {
      setIsSelectingOrganization(false)
      setPendingOrganizationId(null)
    }
  }

  return {
    bootstrapPhase,
    bootstrapLoadError,
    fallbackMessage,
    isSelectingOrganization,
    pendingOrganizationId,
    selectionError,
    selectOrganization,
    retryAutoSelection: () => {
      setFallbackMessage(null)
      setBootstrapLoadError(null)
      setSelectionError(null)
      setBootstrapPhase('idle')
      setRetryNonce((current) => current + 1)
    },
  }
}
