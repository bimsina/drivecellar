import { Link } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'

import { cn } from '#/lib/utils'

type SidebarItem = {
  label: string
  hint?: string
  icon: LucideIcon
  active?: boolean
  disabled?: boolean
} & (
  | {
      kind?: 'button'
      onClick?: () => void
    }
  | {
      kind: 'link'
      to: string
      params?: Record<string, string>
    }
)

type SidebarSection = {
  title: string
  items: SidebarItem[]
}

export function WorkspaceSidebar({
  title,
  subtitle,
  sections,
  className,
}: {
  title: string
  subtitle?: string
  sections: SidebarSection[]
  className?: string
}) {
  return (
    <aside
      className={cn(
        'bg-sidebar text-sidebar-foreground border-sidebar-border flex min-h-0 flex-col rounded-[calc(var(--radius)+8px)] border p-3',
        className,
      )}
    >
      <div className="border-sidebar-border mb-4 border-b px-2 pb-3">
        <p className="text-sidebar-foreground text-sm font-semibold">{title}</p>
        {subtitle ? (
          <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
        ) : null}
      </div>

      <div className="min-h-0 space-y-4 overflow-auto pr-1">
        {sections.map((section) => (
          <section key={section.title} className="space-y-1.5">
            <h2 className="text-muted-foreground px-2 text-[0.7rem] font-semibold tracking-[0.12em] uppercase">
              {section.title}
            </h2>
            <div className="space-y-1">
              {section.items.map((item) =>
                item.kind === 'link' ? (
                  <Link
                    key={`${section.title}-${item.label}`}
                    to={item.to}
                    params={item.params}
                    className={sidebarItemClassName(item.active, item.disabled)}
                    aria-disabled={item.disabled}
                  >
                    <SidebarItemContent item={item} />
                  </Link>
                ) : (
                  <button
                    key={`${section.title}-${item.label}`}
                    type="button"
                    className={sidebarItemClassName(item.active, item.disabled)}
                    disabled={item.disabled}
                    onClick={item.onClick}
                  >
                    <SidebarItemContent item={item} />
                  </button>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </aside>
  )
}

function SidebarItemContent({ item }: { item: SidebarItem }) {
  const Icon = item.icon

  return (
    <>
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-[calc(var(--radius)+2px)]',
          item.active
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'bg-background/50 text-muted-foreground',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.label}</span>
        {item.hint ? (
          <span className="text-muted-foreground block truncate text-[0.72rem]">
            {item.hint}
          </span>
        ) : null}
      </span>
    </>
  )
}

function sidebarItemClassName(active?: boolean, disabled?: boolean) {
  return cn(
    'flex w-full items-center gap-2 rounded-[calc(var(--radius)+4px)] px-2 py-2 text-left transition-colors',
    active
      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
      : 'hover:bg-sidebar-accent/70',
    disabled && 'pointer-events-none opacity-55',
  )
}
