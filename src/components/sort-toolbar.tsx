import type { ReactNode } from 'react'
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  ChevronDown,
  HardDrive,
  MoreVertical,
  TextCursorInput,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { cn } from '#/lib/utils'

export type ToolbarSortField = 'name' | 'modified' | 'size'

type SortToolbarProps = {
  sortField: ToolbarSortField
  onSortFieldChange: (field: ToolbarSortField) => void
  sortAscending: boolean
  onToggleSortDirection: () => void
  allowedSortFields?: ToolbarSortField[]
  trailing?: ReactNode
  menuItems?: ReactNode
  className?: string
}

const fieldLabels: Record<ToolbarSortField, string> = {
  name: 'Name',
  modified: 'Date modified',
  size: 'File size',
}

const fieldIcons: Record<ToolbarSortField, typeof TextCursorInput> = {
  name: TextCursorInput,
  modified: CalendarDays,
  size: HardDrive,
}

const defaultAllowed: ToolbarSortField[] = ['name', 'modified', 'size']

export function SortToolbar({
  sortField,
  onSortFieldChange,
  sortAscending,
  onToggleSortDirection,
  allowedSortFields = defaultAllowed,
  trailing,
  menuItems,
  className,
}: SortToolbarProps) {
  const fields = allowedSortFields.length ? allowedSortFields : defaultAllowed

  return (
    <div
      className={cn(
        'flex w-full flex-wrap items-center justify-end gap-1',
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:bg-accent hover:text-foreground size-8"
        aria-label={sortAscending ? 'Sort ascending' : 'Sort descending'}
        onClick={onToggleSortDirection}
      >
        {sortAscending ? (
          <ArrowUpAZ className="size-[1.125rem]" />
        ) : (
          <ArrowDownAZ className="size-[1.125rem]" />
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-foreground hover:bg-accent h-8 gap-1 px-2 text-xs font-medium"
          >
            {fieldLabels[sortField]}
            <ChevronDown className="size-4 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[11rem]">
          {fields.map((field) => {
            const Icon = fieldIcons[field]

            return (
              <DropdownMenuItem
                key={field}
                onClick={() => onSortFieldChange(field)}
                className={sortField === field ? 'bg-accent' : ''}
              >
                <Icon className="size-4" />
                {fieldLabels[field]}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {menuItems ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-accent size-8"
              aria-label="More actions"
            >
              <MoreVertical className="size-[1.125rem]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[10rem]">
            {menuItems}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {trailing ? (
        <div className="flex items-center gap-0.5 pl-1">{trailing}</div>
      ) : null}
    </div>
  )
}
