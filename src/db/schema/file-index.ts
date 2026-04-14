import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { users } from './auth.ts'
import { connections } from './connections.ts'

export const fileIndex = sqliteTable(
  'file_index',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    parentPath: text('parent_path').notNull(),
    name: text('name').notNull(),
    isDirectory: integer('is_directory', { mode: 'boolean' }).notNull(),
    size: integer('size'),
    mimeType: text('mime_type'),
    lastModified: integer('last_modified', { mode: 'timestamp_ms' }),
    indexedAt: integer('indexed_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('file_index_connection_path_uidx').on(
      table.connectionId,
      table.path,
    ),
    index('file_index_connection_parent_idx').on(
      table.connectionId,
      table.parentPath,
    ),
    index('file_index_connection_idx').on(table.connectionId),
    index('file_index_name_idx').on(table.name),
  ],
)

export const indexStatus = sqliteTable(
  'index_status',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    lastIndexedAt: integer('last_indexed_at', { mode: 'timestamp_ms' }),
    totalFiles: integer('total_files').default(0).notNull(),
    totalFolders: integer('total_folders').default(0).notNull(),
    totalSize: integer('total_size').default(0).notNull(),
    indexedCount: integer('indexed_count').default(0).notNull(),
    errorMessage: text('error_message'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('index_status_connection_uidx').on(table.connectionId),
  ],
)

export const indexRuns = sqliteTable(
  'index_runs',
  {
    id: text('id').primaryKey(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    trigger: text('trigger').notNull(),
    triggeredByUserId: text('triggered_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
    indexedCount: integer('indexed_count').default(0).notNull(),
    totalFiles: integer('total_files').default(0).notNull(),
    totalFolders: integer('total_folders').default(0).notNull(),
    totalSize: integer('total_size').default(0).notNull(),
    errorMessage: text('error_message'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index('index_runs_connection_started_idx').on(
      table.connectionId,
      table.startedAt,
    ),
    index('index_runs_status_idx').on(table.status),
  ],
)

export const fileIndexRelations = relations(fileIndex, ({ one }) => ({
  connection: one(connections, {
    fields: [fileIndex.connectionId],
    references: [connections.id],
  }),
}))

export const indexStatusRelations = relations(indexStatus, ({ one }) => ({
  connection: one(connections, {
    fields: [indexStatus.connectionId],
    references: [connections.id],
  }),
}))

export const indexRunsRelations = relations(indexRuns, ({ one }) => ({
  connection: one(connections, {
    fields: [indexRuns.connectionId],
    references: [connections.id],
  }),
  triggeredByUser: one(users, {
    fields: [indexRuns.triggeredByUserId],
    references: [users.id],
  }),
}))
