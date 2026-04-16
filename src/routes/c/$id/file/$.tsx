import { createFileRoute } from '@tanstack/react-router'

import { FileDetailPage } from '#/components/file-explorer/file-detail-page'
import { getExplorerPathFromSplat } from '#/lib/explorer-route'

export const Route = createFileRoute('/c/$id/file/$')({
  component: RouteComponent,
})

function RouteComponent() {
  const { id, _splat } = Route.useParams()

  const filePath = getExplorerPathFromSplat(_splat)

  return <FileDetailPage connectionId={id} filePath={filePath} />
}
