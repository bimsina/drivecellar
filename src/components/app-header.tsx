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
        'bg-card/70 z-40 px-3 supports-[backdrop-filter]:backdrop-blur-xl md:px-4',
        wide ? 'py-2.5' : 'py-3',
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
            'text-foreground shrink-0 rounded-[calc(var(--radius)+4px)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--ring)_26%,transparent)]',
            !wide && 'font-semibold',
          )}
        >
          <span className="flex items-center gap-3 rounded-[calc(var(--radius)+4px)] px-1.5 py-1">
            <span className="bg-primary/10 text-primary border-border/40 flex size-8 items-center justify-center rounded-[calc(var(--radius)+2px)] border">
              <HardDrive className="size-4.5" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm leading-none font-semibold tracking-[-0.01em]">
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
            <div className="text-muted-foreground bg-muted/45 hidden h-10 flex-1 items-center justify-center gap-2 rounded-[calc(var(--radius)+4px)] px-4 text-sm lg:flex">
              <Search className="size-4" />
              Browse, search, share
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
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
          className="bg-muted/40 hover:bg-muted/70 h-9 rounded-[calc(var(--radius)+4px)] px-2.5"
        >
          <span className="bg-background/80 text-foreground border-border/40 flex size-7 shrink-0 items-center justify-center rounded-[calc(var(--radius)+2px)] border">
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
