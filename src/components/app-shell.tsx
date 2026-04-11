import type { ReactNode } from 'react'

import { AppHeader } from './app-header'

export function AppShell({
  children,
  footer = true,
}: {
  children: ReactNode
  footer?: boolean
}) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      {footer ? (
        <footer className="text-muted-foreground border-border/80 mt-auto border-t py-6 text-center text-xs">
          DriveCellar — your storage, your interface.
        </footer>
      ) : null}
    </div>
  )
}
