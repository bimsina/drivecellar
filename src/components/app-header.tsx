import { OrganizationSwitcher, UserButton } from '@daveyplate/better-auth-ui'
import { Link } from '@tanstack/react-router'

import { authClient } from '#/lib/auth-client'
import { cn } from '#/lib/utils'

import ThemeToggle from './ThemeToggle'

export function AppHeader({ className }: { className?: string }) {
  const { data: session } = authClient.useSession()
  const { data: organizations } = authClient.useListOrganizations()
  const hasOrgs = (organizations?.length ?? 0) > 0

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md',
        className,
      )}
    >
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <Link
          to="/"
          className="text-foreground shrink-0 font-semibold tracking-tight"
        >
          DriveCellar
        </Link>

        <nav className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
          {session?.user ? (
            <>
              {hasOrgs ? (
                <div className="hidden min-w-0 max-w-[200px] sm:max-w-[260px] md:block">
                  <OrganizationSwitcher
                    hidePersonal
                    className="h-9 w-full max-w-full justify-between border border-border bg-card/80 text-sm shadow-none"
                    size="sm"
                    variant="outline"
                  />
                </div>
              ) : null}
            </>
          ) : null}

          <ThemeToggle />

          <UserButton align="end" size="icon" />
        </nav>
      </div>

      {session?.user && hasOrgs ? (
        <div className="border-border/80 border-t px-4 py-2 md:hidden">
          <OrganizationSwitcher
            hidePersonal
            className="h-9 w-full justify-between border border-border bg-card/80 text-sm shadow-none"
            size="sm"
            variant="outline"
          />
        </div>
      ) : null}
    </header>
  )
}
