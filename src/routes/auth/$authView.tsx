import { AuthView } from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'

import { AppShell } from '#/components/app-shell'

export const Route = createFileRoute('/auth/$authView')({
  component: RouteComponent,
})

function RouteComponent() {
  const { authView } = Route.useParams()

  return (
    <AppShell footer={false}>
      <main className="container mx-auto flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 p-4 md:p-6">
        <div className="w-full max-w-[min(100%,24rem)]">
          <AuthView pathname={authView} />
        </div>
      </main>
    </AppShell>
  )
}
