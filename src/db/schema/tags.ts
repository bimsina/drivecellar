import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { organizations, users } from './auth.ts'
import { fileIndex } from './file-index.ts'

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
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
    uniqueIndex('tags_organization_name_uidx').on(
      table.organizationId,
      table.name,
    ),
    index('tags_organization_idx').on(table.organizationId),
  ],
)

export const fileTags = sqliteTable(
  'file_tags',
  {
    id: text('id').primaryKey(),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    fileId: text('file_id')
      .notNull()
      .references(() => fileIndex.id, { onDelete: 'cascade' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex('file_tags_tag_file_uidx').on(table.tagId, table.fileId),
    index('file_tags_file_idx').on(table.fileId),
    index('file_tags_tag_idx').on(table.tagId),
  ],
)

export const tagsRelations = relations(tags, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tags.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [tags.createdBy],
    references: [users.id],
  }),
  fileTags: many(fileTags),
}))

export const fileTagsRelations = relations(fileTags, ({ one }) => ({
  tag: one(tags, {
    fields: [fileTags.tagId],
    references: [tags.id],
  }),
  file: one(fileIndex, {
    fields: [fileTags.fileId],
    references: [fileIndex.id],
  }),
  creator: one(users, {
    fields: [fileTags.createdBy],
    references: [users.id],
  }),
}))
