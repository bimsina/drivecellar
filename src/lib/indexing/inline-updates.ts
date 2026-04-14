import { and, eq, like, or, sql, type SQL } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { fileIndex } from '#/db/schema/index.ts'
import { computeParentPath, normalizePath } from '#/lib/storage/path-utils.ts'
import type { FileEntry } from '#/lib/storage/types.ts'

function toPathPrefixLike(path: string) {
  return path === '/' ? '/%' : `${path}/%`
}

function buildPathMatchSql(column: SQL<unknown>, normalizedPath: string) {
  return or(
    eq(column, normalizedPath),
    like(column, toPathPrefixLike(normalizedPath)),
  )
}

function replacePathPrefix(
  targetPath: string,
  oldPrefix: string,
  newPrefix: string,
) {
  if (targetPath === oldPrefix) {
    return newPrefix
  }

  if (!targetPath.startsWith(`${oldPrefix}/`)) {
    return targetPath
  }

  return `${newPrefix}${targetPath.slice(oldPrefix.length)}`
}

function pathName(path: string) {
  const segments = path.split('/').filter(Boolean)
  return segments.at(-1) ?? ''
}

function buildAncestorDirectories(path: string) {
  const segments = path.split('/').filter(Boolean)
  const ancestorPaths: string[] = []

  for (let i = 1; i < segments.length; i += 1) {
    ancestorPaths.push(`/${segments.slice(0, i).join('/')}`)
  }

  return ancestorPaths
}

type IndexUpsertRowInput = {
  path: string
  parentPath: string
  name: string
  isDirectory: boolean
  size: number | null
  mimeType: string | null
  lastModified: Date | null
}

function normalizeRow(row: IndexUpsertRowInput): IndexUpsertRowInput | null {
  const path = normalizePath(row.path)

  if (path === '/') {
    return null
  }

  return {
    path,
    parentPath: computeParentPath(path),
    name: row.name.trim() || pathName(path),
    isDirectory: row.isDirectory,
    size: row.isDirectory ? null : row.size,
    mimeType: row.isDirectory ? null : row.mimeType,
    lastModified: row.isDirectory
      ? (row.lastModified ?? null)
      : row.lastModified,
  }
}

function directoryRow(path: string): IndexUpsertRowInput {
  const normalizedPath = normalizePath(path)

  return {
    path: normalizedPath,
    parentPath: computeParentPath(normalizedPath),
    name: pathName(normalizedPath),
    isDirectory: true,
    size: null,
    mimeType: null,
    lastModified: null,
  }
}

export async function upsertIndexRows(
  connectionId: string,
  rows: IndexUpsertRowInput[],
  indexedAt = new Date(),
) {
  const deduped = new Map<string, IndexUpsertRowInput>()

  for (const row of rows) {
    const normalized = normalizeRow(row)
    if (!normalized) {
      continue
    }
    deduped.set(normalized.path, normalized)
  }

  if (deduped.size === 0) {
    return 0
  }

  await db
    .insert(fileIndex)
    .values(
      Array.from(deduped.values()).map((row) => ({
        id: crypto.randomUUID(),
        connectionId,
        path: row.path,
        parentPath: row.parentPath,
        name: row.name,
        isDirectory: row.isDirectory,
        size: row.size,
        mimeType: row.mimeType,
        lastModified: row.lastModified,
        indexedAt,
      })),
    )
    .onConflictDoUpdate({
      target: [fileIndex.connectionId, fileIndex.path],
      set: {
        parentPath: sql`excluded.parent_path`,
        name: sql`excluded.name`,
        isDirectory: sql`excluded.is_directory`,
        size: sql`excluded.size`,
        mimeType: sql`excluded.mime_type`,
        lastModified: sql`excluded.last_modified`,
        indexedAt,
      },
    })

  return deduped.size
}

export async function indexInsertEntry(connectionId: string, entry: FileEntry) {
  const normalizedPath = normalizePath(entry.path)

  if (normalizedPath === '/') {
    return
  }

  const rows: IndexUpsertRowInput[] = buildAncestorDirectories(
    normalizedPath,
  ).map((ancestorPath) => directoryRow(ancestorPath))

  rows.push({
    path: normalizedPath,
    parentPath: computeParentPath(normalizedPath),
    name: entry.name.trim() || pathName(normalizedPath),
    isDirectory: entry.isDirectory,
    size: entry.isDirectory ? null : entry.size,
    mimeType: entry.isDirectory ? null : entry.mimeType,
    lastModified: entry.lastModified,
  })

  await upsertIndexRows(connectionId, rows)
}

export async function indexDeleteEntry(connectionId: string, path: string) {
  const normalizedPath = normalizePath(path)

  if (normalizedPath === '/') {
    await db.delete(fileIndex).where(eq(fileIndex.connectionId, connectionId))
    return
  }

  await db
    .delete(fileIndex)
    .where(
      and(
        eq(fileIndex.connectionId, connectionId),
        buildPathMatchSql(fileIndex.path, normalizedPath),
      ),
    )
}

export async function indexRenameEntry(
  connectionId: string,
  oldPath: string,
  newPath: string,
) {
  const normalizedOldPath = normalizePath(oldPath)
  const normalizedNewPath = normalizePath(newPath)

  if (normalizedOldPath === normalizedNewPath || normalizedOldPath === '/') {
    return
  }

  const rows = await db
    .select({ id: fileIndex.id, path: fileIndex.path })
    .from(fileIndex)
    .where(
      and(
        eq(fileIndex.connectionId, connectionId),
        buildPathMatchSql(fileIndex.path, normalizedOldPath),
      ),
    )

  if (rows.length === 0) {
    return
  }

  const indexedAt = new Date()
  const nextRows = [...rows].sort((a, b) => b.path.length - a.path.length)

  await db.transaction((tx) => {
    for (const row of nextRows) {
      const path = replacePathPrefix(
        row.path,
        normalizedOldPath,
        normalizedNewPath,
      )

      tx.update(fileIndex)
        .set({
          path,
          parentPath: computeParentPath(path),
          name: pathName(path),
          indexedAt,
        })
        .where(eq(fileIndex.id, row.id))
        .run()
    }
  })

  const ancestorRows = buildAncestorDirectories(normalizedNewPath).map((path) =>
    directoryRow(path),
  )

  if (ancestorRows.length > 0) {
    await upsertIndexRows(connectionId, ancestorRows, indexedAt)
  }
}
