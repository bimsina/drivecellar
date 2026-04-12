import {
  FolderOpen,
  HardDrive,
  MoreHorizontal,
  PencilLine,
  Trash2,
} from 'lucide-react'

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
import { Link } from '@tanstack/react-router'

type ConnectionsGridProps = {
  connections: ConnectionListItem[]
  isLoading: boolean
  isRefreshing?: boolean
  errorMessage?: string | null
  onEdit: (connection: ConnectionListItem) => void
  onDelete: (connection: ConnectionListItem) => void
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex min-h-4 items-center">
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="relative flex flex-col items-center rounded-[1.45rem] px-3 py-4 text-center"
          >
            <Skeleton className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full" />
            <div className="relative mb-3 flex h-20 w-24 items-center justify-center">
              <Skeleton className="absolute inset-x-2 top-4 h-12 rounded-[1.2rem]" />
              <Skeleton className="absolute inset-x-4 top-2 h-6 rounded-[0.8rem]" />
              <Skeleton className="relative z-10 h-10 w-10 rounded-xl" />
            </div>
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
        ))}
      </div>

      <Skeleton className="fixed right-6 bottom-6 z-20 h-14 w-14 rounded-full shadow-lg sm:right-8 sm:bottom-8" />
    </div>
  )
}

export function ConnectionsGrid({
  connections,
  isLoading,
  isRefreshing = false,
  errorMessage,
  onEdit,
  onDelete,
}: ConnectionsGridProps) {
  if (isLoading) {
    return <LoadingState />
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Connections could not be loaded</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {connections.length === 0 ? (
        <div className="border-border/80 bg-paper rounded-[2rem] border border-dashed px-6 py-16 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="bg-muted/70 flex size-14 items-center justify-center rounded-full">
              <FolderOpen className="text-muted-foreground/70" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">No connections yet</h2>
              <p className="text-muted-foreground max-w-md text-sm">
                Start with a local path or an S3-compatible bucket so this
                workspace has somewhere to browse from.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex min-h-4 items-center">
            {isRefreshing ? (
              <Skeleton className="h-4 w-16 rounded-full" />
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {connections.map((connection) => (
              <Link
                to="/c/$id"
                params={{ id: connection.id }}
                key={connection.id}
                className="group hover:bg-background/55 relative flex flex-col items-center gap-3 rounded-[1.45rem] px-3 py-4 text-center transition-colors duration-150"
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="absolute top-1.5 right-1.5 rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <MoreHorizontal />
                      <span className="sr-only">
                        Open actions for {connection.name}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => onEdit(connection)}>
                      <PencilLine />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDelete(connection)}
                    >
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <HardDrive className="text-foreground/72 relative z-10 size-10" />

                <div className="text-foreground max-w-full text-sm leading-5 font-medium">
                  {connection.name}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
