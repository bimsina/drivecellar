import { Outlet, createFileRoute } from '@tanstack/react-router'

import { validateExplorerSearch } from '#/lib/explorer-route'

export const Route = createFileRoute('/c/$id')({
  validateSearch: validateExplorerSearch,
  component: Outlet,
})
