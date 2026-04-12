import type { ReactNode } from 'react'

import { cn } from '#/lib/utils'

import { AppHeader } from './app-header'

type AppShellProps = {
  children: ReactNode
  /** Full-width layout for main storage views */
  variant?: 'default' | 'wide'
}

export function AppShell({ children, variant = 'default' }: AppShellProps) {
  const wide = variant === 'wide'

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader variant={variant} />
      <div
        className={cn(
          'mx-auto flex w-full flex-1',
          wide
            ? 'max-w-[100%] px-4 pt-3 pb-6 md:px-6 lg:px-8'
            : 'max-w-[1600px] px-4 pt-5 pb-6 md:px-6 lg:px-8',
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
