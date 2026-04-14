import { and, eq, inArray, like, ne, or, sql, type SQL } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import {
  connectionPermissions,
  connections,
  folderPermissions,
  members,
  sharedLinks,
} from '#/db/schema/index.ts'
import type { FileEntry } from '#/lib/storage/types.ts'
import { normalizePath, PathError } from '#/lib/storage/path-utils.ts'

import type { PermissionAccess } from './connections.ts'

export type OrganizationRole = 'owner' | 'admin' | 'member'

export type PermissionContext = {
  organizationRole: OrganizationRole
  defaultAccess: PermissionAccess
  connectionAccess: PermissionAccess | null
  folderAccesses: Array<{
    path: string
    access: PermissionAccess
  }>
}

function parsePermissionAccess(
  value: string | null | undefined,
): PermissionAccess {
  if (value === 'editor' || value === 'viewer' || value === 'none') {
    return value
  }
  return 'none'
}

export function buildAncestorPaths(inputPath: string): string[] {
  const normalizedPath = normalizePath(inputPath)

  if (normalizedPath === '/') {
    return ['/']
  }

  const segments = normalizedPath.split('/').filter(Boolean)
  const paths: string[] = []

  for (let i = segments.length; i >= 1; i -= 1) {
    paths.push(`/${segments.slice(0, i).join('/')}`)
  }

  paths.push('/')
  return paths
}

export function canRead(access: PermissionAccess) {
  return access === 'editor' || access === 'viewer'
}

export function canWrite(access: PermissionAccess) {
  return access === 'editor'
}

export function isOrganizationAdminRole(role: OrganizationRole) {
  return role === 'owner' || role === 'admin'
}

export function isDescendantOrSelf(path: string, prefix: string) {
  const normalizedPath = normalizePath(path)
  const normalizedPrefix = normalizePath(prefix)

  if (normalizedPrefix === '/') {
    return true
  }

  return (
    normalizedPath === normalizedPrefix ||
    normalizedPath.startsWith(`${normalizedPrefix}/`)
  )
}

function toPathPrefixLike(path: string) {
  const normalizedPath = normalizePath(path)
  return normalizedPath === '/' ? '/%' : `${normalizedPath}/%`
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

export async function getOrganizationRole(
  userId: string,
  organizationId: string,
): Promise<OrganizationRole | null> {
  const [membership] = await db
    .select({ role: members.role })
    .from(members)
    .where(
      and(
        eq(members.userId, userId),
        eq(members.organizationId, organizationId),
      ),
    )

  if (!membership) {
    return null
  }

  return membership.role === 'owner' || membership.role === 'admin'
    ? membership.role
    : 'member'
}

export async function getPermissionContext(
  userId: string,
  organizationId: string,
  connectionId: string,
): Promise<PermissionContext | null> {
  const [organizationRole, connection] = await Promise.all([
    getOrganizationRole(userId, organizationId),
    db.query.connections.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.id, connectionId),
          eq(table.organizationId, organizationId),
        ),
      columns: {
        id: true,
        defaultAccess: true,
      },
    }),
  ])

  if (!organizationRole || !connection) {
    return null
  }

  if (isOrganizationAdminRole(organizationRole)) {
    return {
      organizationRole,
      defaultAccess: 'editor',
      connectionAccess: 'editor',
      folderAccesses: [],
    }
  }

  const [connectionAccessRow, folderAccessRows] = await Promise.all([
    db.query.connectionPermissions.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.connectionId, connectionId), eq(table.userId, userId)),
      columns: { access: true },
    }),
    db.query.folderPermissions.findMany({
      where: (table, { and, eq }) =>
        and(eq(table.connectionId, connectionId), eq(table.userId, userId)),
      columns: {
        path: true,
        access: true,
      },
    }),
  ])

  return {
    organizationRole,
    defaultAccess: parsePermissionAccess(connection.defaultAccess),
    connectionAccess: connectionAccessRow
      ? parsePermissionAccess(connectionAccessRow.access)
      : null,
    folderAccesses: folderAccessRows.map((row) => ({
      path: row.path,
      access: parsePermissionAccess(row.access),
    })),
  }
}

export function resolvePermissionFromContext(
  path: string,
  context: PermissionContext,
): PermissionAccess {
  if (isOrganizationAdminRole(context.organizationRole)) {
    return 'editor'
  }

  const normalizedPath = normalizePath(path)
  const ancestorPaths = buildAncestorPaths(normalizedPath)
  const folderMap = new Map(
    context.folderAccesses.map((entry) => [
      normalizePath(entry.path),
      entry.access,
    ]),
  )

  for (const ancestorPath of ancestorPaths) {
    const access = folderMap.get(ancestorPath)
    if (access) {
      return access
    }
  }

  if (context.connectionAccess) {
    return context.connectionAccess
  }

  return context.defaultAccess
}

export async function resolvePermission(
  userId: string,
  organizationId: string,
  connectionId: string,
  path: string,
): Promise<PermissionAccess> {
  const context = await getPermissionContext(
    userId,
    organizationId,
    connectionId,
  )

  if (!context) {
    return 'none'
  }

  return resolvePermissionFromContext(path, context)
}

export async function canAccessConnection(
  userId: string,
  organizationId: string,
  connectionId: string,
) {
  const context = await getPermissionContext(
    userId,
    organizationId,
    connectionId,
  )

  if (!context) {
    return false
  }

  if (isOrganizationAdminRole(context.organizationRole)) {
    return true
  }

  if (context.defaultAccess !== 'none') {
    return true
  }

  if (context.connectionAccess && context.connectionAccess !== 'none') {
    return true
  }

  return context.folderAccesses.some((entry) => entry.access !== 'none')
}

export async function filterListByPermissions(args: {
  userId: string
  organizationId: string
  connectionId: string
  path: string
  entries: FileEntry[]
}) {
  const context = await getPermissionContext(
    args.userId,
    args.organizationId,
    args.connectionId,
  )

  if (!context) {
    return []
  }

  if (isOrganizationAdminRole(context.organizationRole)) {
    return args.entries
  }

  const grantedFolderPaths = context.folderAccesses
    .filter((entry) => entry.access !== 'none')
    .map((entry) => normalizePath(entry.path))

  return args.entries.filter((entry) => {
    const access = resolvePermissionFromContext(entry.path, context)

    if (canRead(access)) {
      return true
    }

    if (!entry.isDirectory) {
      return false
    }

    return grantedFolderPaths.some(
      (grantedPath) =>
        grantedPath.startsWith(`${entry.path}/`) || grantedPath === entry.path,
    )
  })
}

function buildPathMatchSql(column: SQL<unknown>, normalizedPath: string) {
  return or(
    eq(column, normalizedPath),
    like(column, toPathPrefixLike(normalizedPath)),
  )
}

export async function renameScopedPermissions(
  connectionId: string,
  oldPath: string,
  newPath: string,
) {
  const normalizedOldPath = normalizePath(oldPath)
  const normalizedNewPath = normalizePath(newPath)

  if (normalizedOldPath === normalizedNewPath || normalizedOldPath === '/') {
    return
  }

  const [folderRows, linkRows] = await Promise.all([
    db
      .select({ id: folderPermissions.id, path: folderPermissions.path })
      .from(folderPermissions)
      .where(
        and(
          eq(folderPermissions.connectionId, connectionId),
          buildPathMatchSql(folderPermissions.path, normalizedOldPath),
        ),
      ),
    db
      .select({ id: sharedLinks.id, path: sharedLinks.path })
      .from(sharedLinks)
      .where(
        and(
          eq(sharedLinks.connectionId, connectionId),
          buildPathMatchSql(sharedLinks.path, normalizedOldPath),
        ),
      ),
  ])

  await db.transaction(async (tx) => {
    for (const row of folderRows) {
      await tx
        .update(folderPermissions)
        .set({
          path: replacePathPrefix(
            row.path,
            normalizedOldPath,
            normalizedNewPath,
          ),
        })
        .where(eq(folderPermissions.id, row.id))
    }

    for (const row of linkRows) {
      await tx
        .update(sharedLinks)
        .set({
          path: replacePathPrefix(
            row.path,
            normalizedOldPath,
            normalizedNewPath,
          ),
        })
        .where(eq(sharedLinks.id, row.id))
    }
  })
}

export async function deleteScopedPermissions(
  connectionId: string,
  path: string,
) {
  const normalizedPath = normalizePath(path)

  if (normalizedPath === '/') {
    return
  }

  const pathMatcher = buildPathMatchSql(folderPermissions.path, normalizedPath)
  const linkMatcher = buildPathMatchSql(sharedLinks.path, normalizedPath)

  await db.transaction(async (tx) => {
    await tx
      .delete(folderPermissions)
      .where(and(eq(folderPermissions.connectionId, connectionId), pathMatcher))

    await tx
      .delete(sharedLinks)
      .where(and(eq(sharedLinks.connectionId, connectionId), linkMatcher))
  })
}

export function assertNormalizedPermissionPath(path: string) {
  try {
    return normalizePath(path)
  } catch (error) {
    if (error instanceof PathError) {
      throw error
    }
    throw error
  }
}
