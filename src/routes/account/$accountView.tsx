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
      <main className="flex flex-1 flex-col p-4 md:p-6">
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          <AccountView pathname={accountView} />
        </div>
      </main>
    </AppShell>
  )
}
