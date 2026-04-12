import { UserButton } from '@daveyplate/better-auth-ui'
import { Link } from '@tanstack/react-router'
import { cn } from '#/lib/utils'

import ThemeToggle from './ThemeToggle'

export function AppHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        'border-border/80 bg-background/85 sticky top-0 z-50 border-b backdrop-blur-md',
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
          <ThemeToggle />

          <UserButton align="end" size="icon" />
        </nav>
      </div>
    </header>
  )
}
