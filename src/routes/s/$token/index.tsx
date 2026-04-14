import { createFileRoute } from '@tanstack/react-router'

import { SharedLinkPage } from '#/components/shared-links/shared-link-page'

export const Route = createFileRoute('/s/$token/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { token } = Route.useParams()

  return <SharedLinkPage token={token} path="/" />
}
