import {
  computeParentPath,
  normalizePath,
  PathError,
} from '#/lib/storage/path-utils'

export type ExplorerRouteTarget =
  | {
      to: '/c/$id'
      params: {
        id: string
      }
    }
  | {
      to: '/c/$id/$'
      params: {
        id: string
        _splat: string
      }
    }

export type ExplorerFileDetailRouteTarget = {
  to: '/c/$id/file/$'
  params: {
    id: string
    _splat: string
  }
}

export function getExplorerRouteTarget(
  connectionId: string,
  path: string,
): ExplorerRouteTarget {
  const normalizedPath = normalizePath(path)

  if (normalizedPath === '/') {
    return {
      to: '/c/$id',
      params: { id: connectionId },
    }
  }

  return {
    to: '/c/$id/$',
    params: {
      id: connectionId,
      _splat: normalizedPath.slice(1),
    },
  }
}

/** Full-page file preview at `/c/:id/file/*path`. */
export function getExplorerFileDetailRouteTarget(
  connectionId: string,
  filePath: string,
): ExplorerFileDetailRouteTarget {
  const normalizedPath = normalizePath(filePath)

  return {
    to: '/c/$id/file/$',
    params: {
      id: connectionId,
      _splat: normalizedPath === '/' ? '' : normalizedPath.slice(1),
    },
  }
}

export function getExplorerPathFromSplat(splat: string | undefined): string {
  if (!splat) {
    return '/'
  }

  try {
    return normalizePath(`/${splat}`)
  } catch (error) {
    if (error instanceof PathError) {
      return '/'
    }

    throw error
  }
}

export function validateExplorerSearch(_search: Record<string, unknown>) {
  return {}
}

/** Resolve connection + folder path from the browser URL for search scope (explorer + file preview routes). */
export function getExplorerSearchContextFromPathname(pathname: string): {
  activeConnectionId?: string
  activePath?: string
} {
  if (!pathname.startsWith('/c/')) {
    return {}
  }

  const afterPrefix = pathname.slice('/c/'.length)
  const firstSlash = afterPrefix.indexOf('/')
  const connectionId =
    firstSlash === -1 ? afterPrefix : afterPrefix.slice(0, firstSlash)
  if (!connectionId) {
    return {}
  }

  const rest = firstSlash === -1 ? '' : afterPrefix.slice(firstSlash + 1)

  if (rest === 'file' || rest.startsWith('file/')) {
    const fileSplat = rest === 'file' ? '' : rest.slice('file/'.length)
    try {
      const filePath = getExplorerPathFromSplat(fileSplat || undefined)
      const parentPath = computeParentPath(filePath)
      return { activeConnectionId: connectionId, activePath: parentPath }
    } catch {
      return { activeConnectionId: connectionId, activePath: '/' }
    }
  }

  const activePath = getExplorerPathFromSplat(rest || undefined)
  return { activeConnectionId: connectionId, activePath }
}
