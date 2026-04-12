import { createFileRoute } from '@tanstack/react-router'

import { ExplorerPage } from '#/components/file-explorer/explorer-page'
import { getExplorerPathFromSplat } from '#/lib/explorer-route'

export const Route = createFileRoute('/c/$id/$')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id, _splat } = Route.useParams()

  return (
    <ExplorerPage connectionId={id} path={getExplorerPathFromSplat(_splat)} />
  )
}
