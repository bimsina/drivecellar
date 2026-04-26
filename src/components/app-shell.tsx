import type { ReactNode } from 'react'

import { cn } from '#/lib/utils'

import { AppHeader } from './app-header'

type AppShellProps = {
  children: ReactNode
  showHeader?: boolean
  /** Full-width layout for main storage views */
  variant?: 'default' | 'wide'
}

export function AppShell({
  children,
  showHeader = true,
  variant = 'default',
}: AppShellProps) {
  const wide = variant === 'wide'

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      {showHeader ? <AppHeader variant={variant} /> : null}
      <div
        className={cn(
          'mx-auto flex w-full flex-1',
          wide
            ? 'max-w-[100%] px-3 pt-3 pb-6 md:px-5 lg:px-6'
            : 'max-w-[1480px] px-4 pt-5 pb-8 md:px-6 lg:px-8',
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
