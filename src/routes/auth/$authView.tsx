import { AuthView } from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'

export const Route = createFileRoute('/auth/$authView')({
  component: RouteComponent,
})

function RouteComponent() {
  const { authView } = Route.useParams()

  return (
    <AppShell>
      <main className="flex min-h-[calc(100vh-9rem)] flex-1 flex-col items-center justify-center gap-4 p-4 md:p-6">
        <div className="border-border bg-card w-full max-w-[min(100%,28rem)] rounded-[2rem] border p-4 shadow-sm sm:p-6">
          <AuthView pathname={authView} />
        </div>
      </main>
    </AppShell>
  )
}
