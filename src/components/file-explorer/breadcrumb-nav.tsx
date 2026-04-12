import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '#/components/ui/breadcrumb'
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

  return (
    <Breadcrumb className={cn('min-w-0', className)}>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Storage</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem className="min-w-0">
          {atRoot ? (
            <BreadcrumbPage className="max-w-[min(100%,18rem)] truncate">
              {connectionName}
            </BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link
                to="/c/$id"
                params={{ id: connectionId }}
                search={{ path: '/' }}
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
                  <BreadcrumbSeparator />
                  <BreadcrumbItem className="min-w-0">
                    {isLast ? (
                      <BreadcrumbPage className="max-w-[min(100%,18rem)] truncate">
                        {part}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
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
