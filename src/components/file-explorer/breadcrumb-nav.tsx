import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Home } from 'lucide-react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb'
import { getExplorerRouteTarget } from '#/lib/explorer-route'
import { cn } from '#/lib/utils'

function pathForFolderParts(parts: string[], endIndex: number) {
  const slice = parts.slice(0, endIndex + 1)
  return `/${slice.join('/')}`
}

/** Breadcrumb: Storage → connection → folder segments. */
export function ExplorerBreadcrumb({
  connectionId,
  connectionName,
  path,
  onNavigate,
  className,
}: {
  connectionId: string
  connectionName: string
  path: string
  onNavigate: (path: string) => void
  className?: string
}) {
  const normalized = path === '' ? '/' : path
  const parts = normalized.split('/').filter(Boolean)
  const atRoot = parts.length === 0
  const connectionTarget = getExplorerRouteTarget(connectionId, '/')

  return (
    <Breadcrumb className={cn('min-w-0', className)}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            asChild
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Link to="/" className="flex items-center gap-1">
              <Home className="size-3.5" />
              <span className="sr-only">Storage</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-muted-foreground/50">
          <ChevronRight className="size-3.5" />
        </BreadcrumbSeparator>
        <BreadcrumbItem className="min-w-0">
          {atRoot ? (
            <BreadcrumbPage className="text-foreground max-w-[min(100%,18rem)] truncate font-medium">
              {connectionName}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink
              asChild
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Link
                {...connectionTarget}
                className="max-w-[min(100%,18rem)] truncate"
              >
                {connectionName}
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {!atRoot
          ? parts.map((part, i) => {
              const segPath = pathForFolderParts(parts, i)
              const isLast = i === parts.length - 1
              return (
                <Fragment key={segPath}>
                  <BreadcrumbSeparator className="text-muted-foreground/50">
                    <ChevronRight className="size-3.5" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem className="min-w-0">
                    {isLast ? (
                      <BreadcrumbPage className="text-foreground max-w-[min(100%,18rem)] truncate font-medium">
                        {part}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        asChild
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => onNavigate(segPath)}
                          className="max-w-[min(100%,12rem)] truncate"
                        >
                          {part}
                        </button>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              )
            })
          : null}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
