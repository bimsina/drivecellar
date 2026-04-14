import { createFileRoute } from '@tanstack/react-router'

import { ConnectionIndexingPage } from '#/components/indexing/connection-indexing-page'

export const Route = createFileRoute('/indexing/$cid')({
  component: RouteComponent,
})

function RouteComponent() {
  const { cid } = Route.useParams()

  return <ConnectionIndexingPage connectionId={cid} />
}
