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
      <div
        className={cn(
          'mx-auto flex min-h-screen w-full flex-1 flex-col',
          wide ? 'max-w-[100%]' : 'max-w-[1480px]',
        )}
      >
        {showHeader ? <AppHeader variant={variant} /> : null}
        <div
          className={cn(
            'flex w-full flex-1 pt-2',
            wide ? 'px-3 pb-3 md:px-4 md:pb-4' : 'px-4 pb-4 md:px-6 md:pb-5',
          )}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  )
}
