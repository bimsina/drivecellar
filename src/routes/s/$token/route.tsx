import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/s/$token')({
  validateSearch: (search: Record<string, unknown>) => ({
    password:
      typeof search.password === 'string' && search.password.trim()
        ? search.password
        : undefined,
  }),
  component: Outlet,
})
