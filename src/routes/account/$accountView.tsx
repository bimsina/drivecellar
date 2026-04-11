import { AccountView } from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'

export const Route = createFileRoute('/account/$accountView')({
  component: RouteComponent,
})

function RouteComponent() {
  const { accountView } = Route.useParams()
  return (
    <AppShell>
      <main className="container mx-auto max-w-3xl p-4 md:p-6">
        <AccountView pathname={accountView} />
      </main>
    </AppShell>
  )
}
