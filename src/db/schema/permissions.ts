import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { organizations, users } from './auth.ts'
import { connections } from './connections.ts'

export const connectionPermissions = sqliteTable(
  'connection_permissions',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    access: text('access').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('connection_permissions_connection_user_uidx').on(
      table.connectionId,
      table.userId,
    ),
    index('connection_permissions_user_idx').on(table.userId),
  ],
)

export const folderPermissions = sqliteTable(
  'folder_permissions',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    access: text('access').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('folder_permissions_connection_user_path_uidx').on(
      table.connectionId,
      table.userId,
      table.path,
    ),
    index('folder_permissions_connection_path_idx').on(
      table.connectionId,
      table.path,
    ),
    index('folder_permissions_user_idx').on(table.userId),
  ],
)

export const sharedLinks = sqliteTable(
  'shared_links',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    token: text('token').notNull().unique(),
    isDirectory: integer('is_directory', { mode: 'boolean' })
      .default(false)
      .notNull(),
    passwordHash: text('password_hash'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('shared_links_connection_path_idx').on(
      table.connectionId,
      table.path,
    ),
    index('shared_links_organization_idx').on(table.organizationId),
  ],
)

export const connectionPermissionsRelations = relations(
  connectionPermissions,
  ({ one }) => ({
    connection: one(connections, {
      fields: [connectionPermissions.connectionId],
      references: [connections.id],
    }),
    user: one(users, {
      fields: [connectionPermissions.userId],
      references: [users.id],
    }),
  }),
)

export const folderPermissionsRelations = relations(
  folderPermissions,
  ({ one }) => ({
    connection: one(connections, {
      fields: [folderPermissions.connectionId],
      references: [connections.id],
    }),
    user: one(users, {
      fields: [folderPermissions.userId],
      references: [users.id],
    }),
  }),
)

export const sharedLinksRelations = relations(sharedLinks, ({ one }) => ({
  connection: one(connections, {
    fields: [sharedLinks.connectionId],
    references: [connections.id],
  }),
  organization: one(organizations, {
    fields: [sharedLinks.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [sharedLinks.createdBy],
    references: [users.id],
  }),
}))
