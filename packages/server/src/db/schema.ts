import { sqliteTable, text, integer, primaryKey, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// ── Shared column helpers ──────────────────────────────────────────────────
// UUID PKs and ISO-8601 timestamps are generated app-side (mirrors the previous
// Sequelize UUIDV4 defaults) so query results serialize to the same shape the
// client already consumes. Column *names* stay snake_case to match the old
// `underscored: true` API contract.
const uuidPk = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID())
const createdAt = () => text('created_at').notNull().$defaultFn(() => new Date().toISOString())
const updatedAt = () =>
  text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString())

// ── flats ───────────────────────────────────────────────────────────────────
export const flats = sqliteTable('flats', {
  id: uuidPk(),
  block: text('block').notNull(),
  floor: text('floor').notNull(),
  unit_number: text('unit_number').notNull(),
  registration_password: text('registration_password').notNull(),
  is_registration_open: integer('is_registration_open', { mode: 'boolean' }).notNull().default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

// ── users ─────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: uuidPk(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  password_hash: text('password_hash').notNull(),
  name: text('name').notNull(),
  flat_id: text('flat_id').references(() => flats.id),
  role: text('role', { enum: ['resident', 'oc_committee', 'mgmt_staff', 'admin'] })
    .notNull()
    .default('resident'),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  deleted_at: text('deleted_at'),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

// ── incident_reports ────────────────────────────────────────────────────────
export const incidentReports = sqliteTable('incident_reports', {
  id: uuidPk(),
  reporter_id: text('reporter_id')
    .notNull()
    .references(() => users.id),
  type: text('type', { enum: ['repair', 'complaint', 'inquiry'] }).notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  location_block: text('location_block'),
  location_floor: text('location_floor'),
  location_area: text('location_area'),
  status: text('status', { enum: ['pending', 'in_progress', 'completed'] })
    .notNull()
    .default('pending'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

// ── incident_attachments ────────────────────────────────────────────────────
export const incidentAttachments = sqliteTable('incident_attachments', {
  id: uuidPk(),
  report_id: text('report_id')
    .notNull()
    .references(() => incidentReports.id, { onDelete: 'cascade' }),
  file_path: text('file_path').notNull(),
  file_type: text('file_type').notNull(),
  file_size: integer('file_size').notNull(),
  created_at: createdAt(),
})

// ── incident_comments ───────────────────────────────────────────────────────
export const incidentComments = sqliteTable('incident_comments', {
  id: uuidPk(),
  report_id: text('report_id')
    .notNull()
    .references(() => incidentReports.id, { onDelete: 'cascade' }),
  author_id: text('author_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  is_internal: integer('is_internal', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
})

// ── discussion_boards ───────────────────────────────────────────────────────
export const discussionBoards = sqliteTable('discussion_boards', {
  id: uuidPk(),
  name: text('name').notNull(),
  scope_type: text('scope_type', { enum: ['estate', 'block', 'floor'] }).notNull(),
  scope_block: text('scope_block'),
  scope_floor: text('scope_floor'),
  created_at: createdAt(),
})

// ── discussion_posts ────────────────────────────────────────────────────────
export const discussionPosts = sqliteTable('discussion_posts', {
  id: uuidPk(),
  board_id: text('board_id')
    .notNull()
    .references(() => discussionBoards.id),
  author_id: text('author_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  is_anonymous: integer('is_anonymous', { mode: 'boolean' }).notNull().default(false),
  is_hidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
  is_pinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

// ── post_images ─────────────────────────────────────────────────────────────
export const postImages = sqliteTable('post_images', {
  id: uuidPk(),
  post_id: text('post_id')
    .notNull()
    .references(() => discussionPosts.id, { onDelete: 'cascade' }),
  file_path: text('file_path').notNull(),
  file_size: integer('file_size').notNull(),
  created_at: createdAt(),
})

// ── post_comments ───────────────────────────────────────────────────────────
export const postComments = sqliteTable('post_comments', {
  id: uuidPk(),
  post_id: text('post_id')
    .notNull()
    .references(() => discussionPosts.id, { onDelete: 'cascade' }),
  author_id: text('author_id')
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  is_anonymous: integer('is_anonymous', { mode: 'boolean' }).notNull().default(false),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

// ── post_reactions ──────────────────────────────────────────────────────────
export const postReactions = sqliteTable(
  'post_reactions',
  {
    id: uuidPk(),
    post_id: text('post_id')
      .notNull()
      .references(() => discussionPosts.id, { onDelete: 'cascade' }),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type', { enum: ['like'] }).notNull(),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex('post_reactions_post_user_type_uq').on(t.post_id, t.user_id, t.type)],
)

// ── oc_documents ────────────────────────────────────────────────────────────
export const ocDocuments = sqliteTable('oc_documents', {
  id: uuidPk(),
  publisher_id: text('publisher_id')
    .notNull()
    .references(() => users.id),
  type: text('type', {
    enum: [
      'meeting_minutes',
      'financial_statement',
      'resolution',
      'notice',
      'meeting_livestream',
      'meeting_recording',
    ],
  }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  file_path: text('file_path'),
  external_url: text('external_url'),
  link_type: text('link_type', { enum: ['google_meet', 'google_drive', 'google_site'] }),
  year: integer('year').notNull(),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

// ── notifications ───────────────────────────────────────────────────────────
export const notifications = sqliteTable('notifications', {
  id: uuidPk(),
  sender_id: text('sender_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  body: text('body').notNull(),
  category: text('category', { enum: ['urgent', 'general', 'event'] }).notNull(),
  target_type: text('target_type', { enum: ['all', 'block', 'floor', 'user'] }).notNull(),
  target_block: text('target_block'),
  target_floor: text('target_floor'),
  target_user_id: text('target_user_id').references(() => users.id),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

// ── user_notifications ──────────────────────────────────────────────────────
export const userNotifications = sqliteTable(
  'user_notifications',
  {
    id: uuidPk(),
    notification_id: text('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id),
    is_read: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    read_at: text('read_at'),
  },
  (t) => [index('user_notifications_user_idx').on(t.user_id)],
)

// ── audit_logs ──────────────────────────────────────────────────────────────
export const auditLogs = sqliteTable('audit_logs', {
  id: uuidPk(),
  user_id: text('user_id')
    .notNull()
    .references(() => users.id),
  action: text('action').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: text('entity_id').notNull(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  created_at: createdAt(),
})

// ── user_flats (composite PK join) ──────────────────────────────────────────
export const userFlats = sqliteTable(
  'user_flats',
  {
    user_id: text('user_id')
      .notNull()
      .references(() => users.id),
    flat_id: text('flat_id')
      .notNull()
      .references(() => flats.id),
    linked_at: text('linked_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.flat_id] })],
)

// ── Relations (for Drizzle `with:` nested queries) ──────────────────────────
export const flatsRelations = relations(flats, ({ many }) => ({
  residents: many(users),
  linkedFlats: many(userFlats),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  flat: one(flats, { fields: [users.flat_id], references: [flats.id] }),
  reports: many(incidentReports),
  incidentComments: many(incidentComments),
  posts: many(discussionPosts),
  postComments: many(postComments),
  reactions: many(postReactions),
  publishedDocuments: many(ocDocuments),
  sentNotifications: many(notifications, { relationName: 'sender' }),
  notifications: many(userNotifications),
  auditLogs: many(auditLogs),
  linkedFlats: many(userFlats),
}))

export const userFlatsRelations = relations(userFlats, ({ one }) => ({
  user: one(users, { fields: [userFlats.user_id], references: [users.id] }),
  flat: one(flats, { fields: [userFlats.flat_id], references: [flats.id] }),
}))

export const incidentReportsRelations = relations(incidentReports, ({ one, many }) => ({
  reporter: one(users, { fields: [incidentReports.reporter_id], references: [users.id] }),
  attachments: many(incidentAttachments),
  comments: many(incidentComments),
}))

export const incidentAttachmentsRelations = relations(incidentAttachments, ({ one }) => ({
  report: one(incidentReports, {
    fields: [incidentAttachments.report_id],
    references: [incidentReports.id],
  }),
}))

export const incidentCommentsRelations = relations(incidentComments, ({ one }) => ({
  report: one(incidentReports, {
    fields: [incidentComments.report_id],
    references: [incidentReports.id],
  }),
  author: one(users, { fields: [incidentComments.author_id], references: [users.id] }),
}))

export const discussionBoardsRelations = relations(discussionBoards, ({ many }) => ({
  posts: many(discussionPosts),
}))

export const discussionPostsRelations = relations(discussionPosts, ({ one, many }) => ({
  board: one(discussionBoards, {
    fields: [discussionPosts.board_id],
    references: [discussionBoards.id],
  }),
  author: one(users, { fields: [discussionPosts.author_id], references: [users.id] }),
  images: many(postImages),
  comments: many(postComments),
  reactions: many(postReactions),
}))

export const postImagesRelations = relations(postImages, ({ one }) => ({
  post: one(discussionPosts, { fields: [postImages.post_id], references: [discussionPosts.id] }),
}))

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  post: one(discussionPosts, { fields: [postComments.post_id], references: [discussionPosts.id] }),
  author: one(users, { fields: [postComments.author_id], references: [users.id] }),
}))

export const postReactionsRelations = relations(postReactions, ({ one }) => ({
  post: one(discussionPosts, { fields: [postReactions.post_id], references: [discussionPosts.id] }),
  user: one(users, { fields: [postReactions.user_id], references: [users.id] }),
}))

export const ocDocumentsRelations = relations(ocDocuments, ({ one }) => ({
  publisher: one(users, { fields: [ocDocuments.publisher_id], references: [users.id] }),
}))

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  sender: one(users, {
    fields: [notifications.sender_id],
    references: [users.id],
    relationName: 'sender',
  }),
  recipients: many(userNotifications),
}))

export const userNotificationsRelations = relations(userNotifications, ({ one }) => ({
  notification: one(notifications, {
    fields: [userNotifications.notification_id],
    references: [notifications.id],
  }),
  user: one(users, { fields: [userNotifications.user_id], references: [users.id] }),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.user_id], references: [users.id] }),
}))
