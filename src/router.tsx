import {
  createRouter as createTanStackRouter,
  Link,
} from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { AuthUIProviderTanstack } from '@daveyplate/better-auth-ui/tanstack'

import type { ReactNode } from 'react'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import TanstackQueryProvider, {
  getContext,
} from './integrations/tanstack-query/root-provider'
import { authClient } from './lib/auth-client'
import { authLocalizationOverrides } from './lib/auth-localization'

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,

    Wrap: (props: { children: ReactNode }) => {
      return (
        <TanstackQueryProvider context={context}>
          <AuthUIProviderTanstack
            authClient={authClient}
            organization={true}
            localization={authLocalizationOverrides}
            navigate={(href) => router.navigate({ href })}
            replace={(href) => router.navigate({ href, replace: true })}
            Link={({ href, ..._props }) => <Link to={href} {..._props} />}
          >
            {props.children}
          </AuthUIProviderTanstack>
        </TanstackQueryProvider>
      )
    },
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
