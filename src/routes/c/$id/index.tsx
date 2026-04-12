import { createFileRoute } from '@tanstack/react-router'

import { ExplorerPage } from '#/components/file-explorer/explorer-page'

export const Route = createFileRoute('/c/$id/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id } = Route.useParams()

  return <ExplorerPage connectionId={id} path="/" />
}
