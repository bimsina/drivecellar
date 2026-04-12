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
        <div className="border-border bg-card mx-auto w-full rounded-[2rem] border p-4 shadow-sm sm:p-6">
          <OrganizationView pathname={organizationView} />
        </div>
      </main>
    </AppShell>
  )
}
