import {
  Folder,
  HardDrive,
  MoreVertical,
  PencilLine,
  Plus,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'

import { SortToolbar, type ToolbarSortField } from '#/components/sort-toolbar'
import { Alert, AlertDescription, AlertTitle } from '#/components/ui/alert'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Skeleton } from '#/components/ui/skeleton'
import type { ConnectionListItem } from '#/lib/connections.ts'
import { getExplorerRouteTarget } from '#/lib/explorer-route'
import { cn } from '#/lib/utils'

type ConnectionsGridProps = {
  connections: ConnectionListItem[]
  isLoading: boolean
  isRefreshing?: boolean
  errorMessage?: string | null
  onCreate: () => void
  onEdit: (connection: ConnectionListItem) => void
  onDelete: (connection: ConnectionListItem) => void
}

function sortConnections(
  items: ConnectionListItem[],
  field: ToolbarSortField,
  ascending: boolean,
): ConnectionListItem[] {
  const copy = [...items]
  copy.sort((a, b) => {
    let cmp = 0
    if (field === 'name') {
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    } else if (field === 'modified') {
      cmp = a.updatedAt.getTime() - b.updatedAt.getTime()
    } else {
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    }
    return ascending ? cmp : -cmp
  })
  return copy
}

function LoadingState() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="border-border flex items-center justify-end gap-2 border-b pb-2">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
      <Skeleton className="h-4 w-24 rounded" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col items-center gap-3 px-2 py-4"
          >
            <Skeleton className="size-[5.5rem] rounded-2xl" />
            <Skeleton className="h-4 w-full max-w-[8rem] rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ConnectionsGrid({
  connections,
  isLoading,
  isRefreshing = false,
  errorMessage,
  onCreate,
  onEdit,
  onDelete,
}: ConnectionsGridProps) {
  const [sortField, setSortField] = useState<ToolbarSortField>('name')
  const [sortAscending, setSortAscending] = useState(true)

  const sorted = useMemo(
    () => sortConnections(connections, sortField, sortAscending),
    [connections, sortAscending, sortField],
  )

  if (isLoading) {
    return <LoadingState />
  }

  return (
    <div className="w-full space-y-2">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load storage</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {connections.length === 0 ? (
        <div className="flex min-h-[min(60vh,24rem)] flex-col items-center justify-center px-4 py-16 text-center">
          <div className="text-muted-foreground">
            <Folder className="mx-auto size-12" strokeWidth={1.25} />
          </div>
          <h2 className="text-foreground mt-6 text-base font-medium">
            No storage connections yet
          </h2>
          <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
            Add a location to browse files.
          </p>
          <Button
            type="button"
            className="mt-6 h-9 rounded-md px-4 font-medium"
            onClick={onCreate}
          >
            <Plus className="mr-2 size-4" />
            New
          </Button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6">
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pt-1 pb-2">
            <Button
              type="button"
              variant="outline"
              className="border-border text-foreground hover:bg-accent h-9 rounded-md bg-transparent px-3 font-normal"
              onClick={onCreate}
            >
              <Plus className="text-primary mr-2 size-4" />
              New
            </Button>
            <SortToolbar
              className="flex-1 border-0 pb-0"
              sortField={sortField}
              onSortFieldChange={setSortField}
              sortAscending={sortAscending}
              onToggleSortDirection={() => setSortAscending((v) => !v)}
              allowedSortFields={['name', 'modified']}
              menuItems={
                <DropdownMenuItem onClick={onCreate}>
                  <Plus className="size-4" />
                  New storage
                </DropdownMenuItem>
              }
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-foreground text-sm font-medium">Storage</h2>
              {isRefreshing ? (
                <span className="text-muted-foreground text-xs">Updating…</span>
              ) : null}
            </div>

            <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {sorted.map((connection) => (
                <li key={connection.id} className="min-w-0">
                  <ConnectionTile
                    connection={connection}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectionTile({
  connection,
  onEdit,
  onDelete,
}: Pick<ConnectionsGridProps, 'onEdit' | 'onDelete'> & {
  connection: ConnectionListItem
}) {
  const rootTarget = getExplorerRouteTarget(connection.id, '/')

  return (
    <div className="relative min-w-0">
      <Link
        {...rootTarget}
        className={cn(
          'flex min-h-[9.5rem] flex-col items-center gap-3 rounded-xl px-3 py-4 text-center transition-colors',
          'text-foreground hover:bg-accent focus-visible:ring-ring outline-none focus-visible:ring-2',
        )}
      >
        <span className="bg-muted/60 text-primary dark:bg-muted/40 flex size-[5.5rem] shrink-0 items-center justify-center rounded-2xl">
          <HardDrive className="size-14" strokeWidth={1.25} aria-hidden />
        </span>
        <span className="w-full min-w-0 px-0.5">
          <span className="line-clamp-2 text-sm leading-snug font-medium">
            {connection.name}
          </span>
          {connection.description ? (
            <span className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
              {connection.description}
            </span>
          ) : null}
        </span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-accent absolute top-1 right-1 size-8"
            onClick={(event) => {
              event.preventDefault()
            }}
          >
            <MoreVertical className="size-[1.125rem]" />
            <span className="sr-only">More actions for {connection.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[10rem]">
          <DropdownMenuItem asChild>
            <Link {...rootTarget}>Open</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation()
              onEdit(connection)
            }}
          >
            <PencilLine className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(connection)
            }}
          >
            <Trash2 className="size-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
