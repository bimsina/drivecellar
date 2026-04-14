import { relations, sql } from 'drizzle-orm'
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { organizations, users } from './auth.ts'

export const connections = sqliteTable(
  'connections',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    type: text('type').notNull(), // "s3" | "local"
    defaultAccess: text('default_access').notNull(), // "editor" | "viewer" | "none"
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    config: text('config').notNull(), // JSON — validated by Zod at app layer
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
    index('connections_organizationId_idx').on(table.organizationId),
    index('connections_defaultAccess_idx').on(table.defaultAccess),
  ],
)

export const connectionsRelations = relations(connections, ({ one }) => ({
  organization: one(organizations, {
    fields: [connections.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [connections.createdBy],
    references: [users.id],
  }),
}))
