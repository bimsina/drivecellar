import { createFileRoute } from '@tanstack/react-router'

import { SharedLinkPage } from '#/components/shared-links/shared-link-page'
import { getExplorerPathFromSplat } from '#/lib/explorer-route'

export const Route = createFileRoute('/s/$token/$')({
  component: RouteComponent,
})

function RouteComponent() {
  const { token, _splat } = Route.useParams()

  return (
    <SharedLinkPage token={token} path={getExplorerPathFromSplat(_splat)} />
  )
}
