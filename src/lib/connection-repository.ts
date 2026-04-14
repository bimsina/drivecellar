import { and, desc, eq, exists, ne, or, sql } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import {
  connectionPermissions,
  connections,
  folderPermissions,
} from '#/db/schema/index.ts'

export type ConnectionRow = typeof connections.$inferSelect
type NewConnectionRow = typeof connections.$inferInsert

export function listConnectionsForOrganization(organizationId: string) {
  return db
    .select()
    .from(connections)
    .where(eq(connections.organizationId, organizationId))
    .orderBy(desc(connections.updatedAt))
}

export function listVisibleConnectionsForUser(
  organizationId: string,
  userId: string,
) {
  const connectionPermissionExists = db
    .select({ value: sql`1` })
    .from(connectionPermissions)
    .where(
      and(
        eq(connectionPermissions.connectionId, connections.id),
        eq(connectionPermissions.userId, userId),
        ne(connectionPermissions.access, 'none'),
      ),
    )

  const folderPermissionExists = db
    .select({ value: sql`1` })
    .from(folderPermissions)
    .where(
      and(
        eq(folderPermissions.connectionId, connections.id),
        eq(folderPermissions.userId, userId),
        ne(folderPermissions.access, 'none'),
      ),
    )

  return db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.organizationId, organizationId),
        or(
          ne(connections.defaultAccess, 'none'),
          exists(connectionPermissionExists),
          exists(folderPermissionExists),
        ),
      ),
    )
    .orderBy(desc(connections.updatedAt))
}

export async function getConnectionByIdForOrganization(
  id: string,
  organizationId: string,
) {
  const [connection] = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.id, id),
        eq(connections.organizationId, organizationId),
      ),
    )

  return connection ?? null
}

export async function getConnectionById(id: string) {
  const [connection] = await db
    .select()
    .from(connections)
    .where(eq(connections.id, id))

  return connection ?? null
}

export async function createConnectionRow(values: NewConnectionRow) {
  await db.insert(connections).values(values)
  return getConnectionByIdForOrganization(values.id, values.organizationId)
}

export async function updateConnectionRow(
  id: string,
  organizationId: string,
  values: Partial<NewConnectionRow>,
) {
  await db
    .update(connections)
    .set(values)
    .where(
      and(
        eq(connections.id, id),
        eq(connections.organizationId, organizationId),
      ),
    )

  return getConnectionByIdForOrganization(id, organizationId)
}

export async function deleteConnectionRow(id: string, organizationId: string) {
  const existing = await getConnectionByIdForOrganization(id, organizationId)

  if (!existing) {
    return false
  }

  await db
    .delete(connections)
    .where(
      and(
        eq(connections.id, id),
        eq(connections.organizationId, organizationId),
      ),
    )

  return true
}
