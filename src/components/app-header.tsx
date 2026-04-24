import { OrganizationSwitcher, UserButton } from '@daveyplate/better-auth-ui'
import { Link, useRouterState } from '@tanstack/react-router'
import { Building2, ChevronsUpDown, HardDrive, Search } from 'lucide-react'
import { useMemo } from 'react'

import { authClient } from '#/lib/auth-client'
import { getExplorerSearchContextFromPathname } from '#/lib/explorer-route'
import { cn } from '#/lib/utils'

import { AppHeaderSearch } from './app-header-search'
import { Button } from './ui/button'
import ThemeToggle from './ThemeToggle'

type AppHeaderProps = {
  className?: string
  variant?: 'default' | 'wide'
}

export function AppHeader({ className, variant = 'default' }: AppHeaderProps) {
  const { data: session } = authClient.useSession()
  const activeOrganizationId = session?.session.activeOrganizationId ?? null

  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { activeConnectionId, activePath } = useMemo(
    () => getExplorerSearchContextFromPathname(pathname),
    [pathname],
  )

  const wide = variant === 'wide'

  return (
    <header
      className={cn(
        'border-border/60 bg-background/82 sticky top-0 z-50 border-b px-3 supports-[backdrop-filter]:backdrop-blur-xl md:px-5 lg:px-6',
        wide ? 'py-2' : 'py-3',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex w-full items-center justify-between gap-3',
          wide ? 'max-w-[100%]' : 'max-w-[1480px]',
        )}
      >
        <Link
          to="/"
          className={cn(
            'text-foreground shrink-0 rounded-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--ring)_26%,transparent)]',
            !wide && 'font-semibold',
          )}
        >
          <span className="flex items-center gap-2 rounded-sm px-1 py-1">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-sm">
              <HardDrive className="size-4.5" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm leading-none font-semibold">
                DriveCellar
              </span>
            </span>
          </span>
        </Link>

        <div className="mx-1 flex max-w-3xl min-w-0 flex-1 justify-center md:mx-3">
          {session?.user && activeOrganizationId ? (
            <AppHeaderSearch
              organizationId={activeOrganizationId}
              activeConnectionId={activeConnectionId}
              activePath={activePath}
            />
          ) : (
            <div className="text-muted-foreground border-border/80 bg-card hidden flex-1 items-center justify-center gap-2 rounded-sm border px-4 py-2 text-sm lg:flex">
              <Search className="size-4" />
              Browse, search, share
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
          {session?.user ? <HeaderOrganizationSwitcher /> : null}

          <ThemeToggle />
          <UserButton align="end" size="icon" />
        </div>
      </div>
    </header>
  )
}

function HeaderOrganizationSwitcher() {
  const { data: session } = authClient.useSession()
  const { data: organizations } = authClient.useListOrganizations()

  const activeOrgId = session?.session.activeOrganizationId ?? null
  const activeOrganization =
    organizations?.find((organization) => organization.id === activeOrgId) ??
    null
  const organizationLabel =
    activeOrganization?.name ?? organizations?.[0]?.name ?? 'Select team'

  if ((organizations?.length ?? 0) === 0) {
    return null
  }

  return (
    <OrganizationSwitcher
      hidePersonal
      size="sm"
      sideOffset={8}
      classNames={{
        content: {
          base: 'rounded-sm border border-border bg-popover p-2 shadow-2xl shadow-black/12',
          menuItem: 'rounded-sm',
        },
      }}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          title={organizationLabel}
          type="button"
        >
          <span className="bg-muted text-foreground border-border/70 flex size-7 shrink-0 items-center justify-center rounded-sm border">
            <Building2 className="size-4" aria-hidden />
          </span>
          <span className="hidden min-w-0 flex-1 truncate text-left text-sm sm:block">
            {organizationLabel}
          </span>
          <ChevronsUpDown
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        </Button>
      }
    />
  )
}
