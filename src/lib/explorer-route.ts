import { normalizePath, PathError } from '#/lib/storage/path-utils'

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

export function validateExplorerSearch(search: Record<string, unknown>) {
  const rawFile = typeof search.file === 'string' ? search.file : undefined

  if (!rawFile) {
    return { file: undefined }
  }

  try {
    return { file: normalizePath(rawFile) }
  } catch (error) {
    if (error instanceof PathError) {
      return { file: undefined }
    }

    throw error
  }
}
