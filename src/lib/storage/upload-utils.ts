import { normalizePath, PathError } from './path-utils.ts'
import type { StorageProvider } from './types.ts'

export type UploadConflictMode = 'rename'
export type UploadConflictResolution = 'none' | 'renamed'

function normalizeRelativeUploadPath(
  relativePath: string | null | undefined,
  fileName: string,
) {
  const raw = relativePath?.trim() ? relativePath : fileName
  const normalized = normalizePath(raw)

  if (normalized === '/') {
    throw new PathError('Upload path must point to a file.')
  }

  return normalized
}

export function buildRequestedUploadPath(
  directoryPath: string,
  relativePath: string | null | undefined,
  fileName: string,
) {
  const normalizedDirectory = normalizePath(directoryPath)
  const normalizedRelative = normalizeRelativeUploadPath(relativePath, fileName)

  if (normalizedDirectory === '/') {
    return normalizedRelative
  }

  return normalizePath(`${normalizedDirectory}${normalizedRelative}`)
}

function splitBaseName(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')

  if (dotIndex <= 0) {
    return {
      baseName: fileName,
      extension: '',
    }
  }

  return {
    baseName: fileName.slice(0, dotIndex),
    extension: fileName.slice(dotIndex),
  }
}

export function appendConflictSuffix(entryPath: string, attempt: number) {
  if (attempt < 1) {
    throw new Error('Attempt must be greater than 0.')
  }

  const segments = entryPath.split('/').filter(Boolean)
  const fileName = segments.pop()

  if (!fileName) {
    throw new PathError('Upload path must point to a file.')
  }

  const { baseName, extension } = splitBaseName(fileName)
  const nextName = `${baseName} (${attempt})${extension}`
  const prefix = segments.join('/')

  return prefix ? `/${prefix}/${nextName}` : `/${nextName}`
}

async function pathExists(provider: StorageProvider, entryPath: string) {
  try {
    await provider.stat(entryPath)
    return true
  } catch {
    return false
  }
}

export async function resolveUploadPathConflict(
  provider: StorageProvider,
  requestedPath: string,
  conflictMode: UploadConflictMode = 'rename',
): Promise<{
  resolvedPath: string
  conflictResolution: UploadConflictResolution
}> {
  const exists = await pathExists(provider, requestedPath)

  if (!exists) {
    return {
      resolvedPath: requestedPath,
      conflictResolution: 'none',
    }
  }

  if (conflictMode !== 'rename') {
    return {
      resolvedPath: requestedPath,
      conflictResolution: 'none',
    }
  }

  let attempt = 1

  for (;;) {
    const candidatePath = appendConflictSuffix(requestedPath, attempt)
    const candidateExists = await pathExists(provider, candidatePath)

    if (!candidateExists) {
      return {
        resolvedPath: candidatePath,
        conflictResolution: 'renamed',
      }
    }

    attempt += 1
  }
}
