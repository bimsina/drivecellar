import { AppShell } from '#/components/app-shell'
import { OrganizationView } from '@daveyplate/better-auth-ui'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/organization/$organizationView')({
  component: RouteComponent,
})

function RouteComponent() {
  const { organizationView } = Route.useParams()
  return (
    <AppShell>
      <main className="flex flex-1 flex-col p-4 md:p-6">
        <div className="mx-auto w-full p-4 sm:p-6">
          <OrganizationView pathname={organizationView} />
        </div>
      </main>
    </AppShell>
  )
}
