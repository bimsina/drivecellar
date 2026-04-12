import { UserButton } from '@daveyplate/better-auth-ui'
import { Link } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'

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
        'sticky top-0 z-50 px-4 md:px-6 lg:px-8',
        wide ? 'border-border bg-background border-b pt-3 pb-0' : 'pt-4',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex w-full items-center justify-between gap-3 py-3',
          wide
            ? 'max-w-[100%]'
            : 'border-border bg-card max-w-[1600px] rounded-xl border px-4 shadow-sm sm:px-5',
        )}
      >
        <Link
          to="/"
          className={cn(
            'text-foreground shrink-0 text-lg font-medium',
            !wide && 'font-semibold',
          )}
        >
          DriveCellar
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
