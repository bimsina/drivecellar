import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { fileIndex, indexRuns, indexStatus } from '#/db/schema/index.ts'

export type IndexStatusRow = typeof indexStatus.$inferSelect
export type IndexRunRow = typeof indexRuns.$inferSelect

type ListFromIndexBatchArgs = {
  connectionId: string
  parentPath: string
  isDirectory: boolean
  offset: number
  limit: number
}

export async function listFromIndexBatch({
  connectionId,
  parentPath,
  isDirectory,
  offset,
  limit,
}: ListFromIndexBatchArgs) {
  if (limit <= 0) {
    return []
  }

  const rows = await db
    .select({
      name: fileIndex.name,
      path: fileIndex.path,
      isDirectory: fileIndex.isDirectory,
      size: fileIndex.size,
      mimeType: fileIndex.mimeType,
      color: fileIndex.color,
      icon: fileIndex.icon,
      lastModified: fileIndex.lastModified,
    })
    .from(fileIndex)
    .where(
      and(
        eq(fileIndex.connectionId, connectionId),
        eq(fileIndex.parentPath, parentPath),
        eq(fileIndex.isDirectory, isDirectory),
      ),
    )
    .orderBy(asc(fileIndex.name))
    .offset(offset)
    .limit(limit)

  return rows
}

export async function listFromIndex(connectionId: string, parentPath: string) {
  const [folders, files] = await Promise.all([
    listFromIndexBatch({
      connectionId,
      parentPath,
      isDirectory: true,
      offset: 0,
      limit: Number.MAX_SAFE_INTEGER,
    }),
    listFromIndexBatch({
      connectionId,
      parentPath,
      isDirectory: false,
      offset: 0,
      limit: Number.MAX_SAFE_INTEGER,
    }),
  ])

  return [...folders, ...files]
}

export async function hasCompletedIndex(connectionId: string) {
  const [status] = await db
    .select({ connectionId: indexStatus.connectionId })
    .from(indexStatus)
    .where(
      and(
        eq(indexStatus.connectionId, connectionId),
        isNotNull(indexStatus.lastIndexedAt),
      ),
    )
    .limit(1)

  return Boolean(status)
}

export async function getIndexStatus(connectionId: string) {
  const [status] = await db
    .select()
    .from(indexStatus)
    .where(eq(indexStatus.connectionId, connectionId))
    .limit(1)

  return status ?? null
}

export async function clearConnectionIndex(connectionId: string) {
  await db.transaction((tx) => {
    tx.delete(fileIndex).where(eq(fileIndex.connectionId, connectionId)).run()

    tx.delete(indexStatus)
      .where(eq(indexStatus.connectionId, connectionId))
      .run()
  })
}

export async function listIndexRuns(connectionId: string, limit = 50) {
  return db
    .select()
    .from(indexRuns)
    .where(eq(indexRuns.connectionId, connectionId))
    .orderBy(desc(indexRuns.startedAt))
    .limit(limit)
}

export async function getIndexedEntryCount(connectionId: string) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(fileIndex)
    .where(eq(fileIndex.connectionId, connectionId))

  return row?.count ?? 0
}
