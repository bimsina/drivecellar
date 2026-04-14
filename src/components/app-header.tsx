import { OrganizationSwitcher, UserButton } from '@daveyplate/better-auth-ui'
import { Link } from '@tanstack/react-router'
import { Building2, ChevronsUpDown, HardDrive } from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { cn } from '#/lib/utils'

import { Button } from './ui/button'
import ThemeToggle from './ThemeToggle'

type AppHeaderProps = {
  className?: string
  variant?: 'default' | 'wide'
}

export function AppHeader({ className, variant = 'default' }: AppHeaderProps) {
  const { data: session } = authClient.useSession()

  const wide = variant === 'wide'

  return (
    <header
      className={cn(
        'bg-background sticky top-0 z-50 px-4 md:px-6 lg:px-8',
        wide ? 'pt-3 pb-0' : 'pt-4',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex w-full items-center justify-between gap-3 py-3',
          wide ? 'max-w-[100%]' : 'max-w-[1600px] rounded-xl px-4 sm:px-5',
        )}
      >
        <Link
          to="/"
          className={cn(
            'text-foreground shrink-0 text-lg font-medium',
            !wide && 'font-semibold',
          )}
        >
          <span className="flex items-center gap-2.5">
            <span className="bg-primary/10 flex items-center justify-center rounded-lg p-1.5">
              <HardDrive className="text-primary size-5" strokeWidth={2} />
            </span>
            DriveCellar
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
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
          base: 'rounded-2xl border border-border bg-popover p-2 shadow-xl',
          menuItem: 'rounded-xl',
        },
      }}
      trigger={
        <Button
          variant="ghost"
          size="sm"
          className="flex max-w-[min(100%,15rem)] min-w-0 items-center gap-2 rounded-xl px-2.5 sm:px-3"
          title={organizationLabel}
          type="button"
        >
          <span className="bg-primary/10 flex size-7 shrink-0 items-center justify-center rounded-lg">
            <Building2 className="text-primary size-4" aria-hidden />
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
