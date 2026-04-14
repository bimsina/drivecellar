/**
 * Normalizes a path to an absolute path from the connection root.
 * Ensures a leading `/`, resolves `.` / `..`, rejects null bytes and paths that escape root.
 */
export function normalizePath(input: string): string {
  if (input.includes('\0')) {
    throw new PathError('Path contains invalid characters.')
  }

  let s = input.replace(/\\/g, '/').trim()
  if (s === '') {
    return '/'
  }

  if (!s.startsWith('/')) {
    s = `/${s}`
  }

  const segments = s.split('/').filter((seg) => seg.length > 0)
  const stack: string[] = []

  for (const segment of segments) {
    if (segment === '.' || segment === '') {
      continue
    }
    if (segment === '..') {
      if (stack.length === 0) {
        throw new PathError('Path escapes the connection root.')
      }
      stack.pop()
    } else {
      stack.push(segment)
    }
  }

  return stack.length === 0 ? '/' : `/${stack.join('/')}`
}

export function computeParentPath(input: string): string {
  const normalizedPath = normalizePath(input)

  if (normalizedPath === '/') {
    return '/'
  }

  const lastSlashIndex = normalizedPath.lastIndexOf('/')
  if (lastSlashIndex <= 0) {
    return '/'
  }

  return normalizedPath.slice(0, lastSlashIndex)
}

export class PathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathError'
  }
}
