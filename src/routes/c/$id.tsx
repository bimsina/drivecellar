import { AppShell } from '#/components/app-shell'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/c/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  return <AppShell>Hello "/c/$id"!</AppShell>
}
