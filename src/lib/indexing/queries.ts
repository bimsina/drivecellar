import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { fileIndex, indexRuns, indexStatus } from '#/db/schema/index.ts'

export type IndexStatusRow = typeof indexStatus.$inferSelect
export type IndexRunRow = typeof indexRuns.$inferSelect

export async function listFromIndex(connectionId: string, parentPath: string) {
  const rows = await db
    .select({
      name: fileIndex.name,
      path: fileIndex.path,
      isDirectory: fileIndex.isDirectory,
      size: fileIndex.size,
      mimeType: fileIndex.mimeType,
      lastModified: fileIndex.lastModified,
    })
    .from(fileIndex)
    .where(
      and(
        eq(fileIndex.connectionId, connectionId),
        eq(fileIndex.parentPath, parentPath),
      ),
    )
    .orderBy(desc(fileIndex.isDirectory), asc(fileIndex.name))

  return rows
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
