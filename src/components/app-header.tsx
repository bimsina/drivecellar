import { UserButton } from '@daveyplate/better-auth-ui'
import { Link } from '@tanstack/react-router'
import { Building2, HardDrive } from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { cn } from '#/lib/utils'

import ThemeToggle from './ThemeToggle'

type AppHeaderProps = {
  className?: string
  variant?: 'default' | 'wide'
}

export function AppHeader({ className, variant = 'default' }: AppHeaderProps) {
  const { data: session } = authClient.useSession()
  const { data: organizations } = authClient.useListOrganizations()

  const activeOrgId = session?.session.activeOrganizationId ?? null

  const activeOrganization =
    organizations?.find((organization) => organization.id === activeOrgId) ??
    null

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
          {activeOrganization ? (
            <div
              className="text-muted-foreground hidden max-w-[min(100%,14rem)] min-w-0 items-center gap-1.5 text-sm sm:flex"
              title={activeOrganization.name}
            >
              <Building2 className="text-primary size-4 shrink-0" aria-hidden />
              <span className="truncate">{activeOrganization.name}</span>
            </div>
          ) : null}

          <ThemeToggle />
          <UserButton align="end" size="icon" />
        </div>
      </div>
    </header>
  )
}
