import { and, asc, desc, eq, isNull, like, or, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import type { Env } from '../../env.js'
import { notifications, userNotifications, users, flats } from '../../db/schema.js'
import { parsePagination, paginatedResponse, type PaginatedResponse } from '../../utils/pagination.js'
import { HttpError } from '../errors.js'
import { sanitizeText } from '../sanitize.js'
import * as pushService from './push.js'

export interface SendNotificationData {
  title: string
  body: string
  category: 'urgent' | 'general' | 'event'
  targetType: 'all' | 'block' | 'floor' | 'user'
  targetBlock?: string
  targetFloor?: string
  targetUserId?: string
}

export interface ListNotificationFilters {
  page?: string | number
  limit?: string | number
  unreadOnly?: boolean
}

export interface RecipientSummary {
  id: string
  name: string
  email: string
  flatLabel: string | null
}

type NotificationRow = typeof notifications.$inferSelect

/**
 * Compose + fan out a targeted notification. Creates the Notification record,
 * resolves recipients (all / block / floor / user), bulk-inserts the per-user
 * rows, and fires web push. The old Redis pub/sub `notify:user:*` publish is
 * intentionally dropped — nothing subscribed to it.
 */
export async function send(
  db: Db,
  env: Env,
  senderId: string,
  data: SendNotificationData,
): Promise<{ notification: NotificationRow; targetCount: number }> {
  // For an individual reminder, validate the recipient up-front so the caller
  // gets a clean error instead of a notification that reaches nobody.
  if (data.targetType === 'user') {
    if (!data.targetUserId) {
      throw new HttpError(400, 'targetUserId is required for user target')
    }
    const [recipient] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, data.targetUserId), eq(users.is_active, true), isNull(users.deleted_at)))
      .limit(1)
    if (!recipient) {
      throw new HttpError(404, 'Recipient not found')
    }
  }

  // 1. Create Notification record
  const [notification] = await db
    .insert(notifications)
    .values({
      sender_id: senderId,
      title: sanitizeText(data.title),
      body: sanitizeText(data.body),
      category: data.category,
      target_type: data.targetType,
      target_block: data.targetBlock ?? null,
      target_floor: data.targetFloor ?? null,
      target_user_id: data.targetType === 'user' ? data.targetUserId! : null,
    })
    .returning()

  // 2. Resolve target users. Block/floor scoping uses the user's primary flat
  // (users.flat_id) exactly as the Sequelize source did.
  let targetUserIds: string[]

  if (data.targetType === 'user') {
    targetUserIds = [data.targetUserId!]
  } else if (data.targetType === 'block' && data.targetBlock) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(flats, eq(users.flat_id, flats.id))
      .where(and(eq(users.is_active, true), eq(flats.block, data.targetBlock)))
    targetUserIds = rows.map((r) => r.id)
  } else if (data.targetType === 'floor' && data.targetBlock && data.targetFloor) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(flats, eq(users.flat_id, flats.id))
      .where(
        and(
          eq(users.is_active, true),
          eq(flats.block, data.targetBlock),
          eq(flats.floor, data.targetFloor),
        ),
      )
    targetUserIds = rows.map((r) => r.id)
  } else {
    // 'all' (and any block/floor request missing its scope params, matching the
    // source, which only joins the flat table when the params are present).
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.is_active, true))
    targetUserIds = rows.map((r) => r.id)
  }

  // 3. Bulk create UserNotification rows
  if (targetUserIds.length > 0) {
    await db
      .insert(userNotifications)
      .values(targetUserIds.map((userId) => ({ notification_id: notification.id, user_id: userId })))
  }

  // 4. Web Push (fire-and-forget)
  pushService
    .sendToUsers(env, targetUserIds, {
      title: notification.title,
      body: notification.body,
      category: notification.category,
    })
    .catch(() => {})

  return { notification, targetCount: targetUserIds.length }
}

/**
 * Re-push an existing notification to its original recipients. Does NOT create
 * new Notification/UserNotification rows — simply triggers another web push.
 * Intended for reminders ("meeting tonight"). Caller may override the push
 * title/body; empty/undefined overrides fall back to the original text.
 */
export async function resend(
  db: Db,
  env: Env,
  notificationId: string,
  overrides: { title?: string; body?: string } | undefined,
): Promise<{ notification: NotificationRow; targetCount: number }> {
  const notification = await db.query.notifications.findFirst({
    where: eq(notifications.id, notificationId),
  })
  if (!notification) {
    throw new HttpError(404, 'Notification not found')
  }

  const rows = await db
    .select({ user_id: userNotifications.user_id })
    .from(userNotifications)
    .where(eq(userNotifications.notification_id, notificationId))
  const targetUserIds = rows.map((r) => r.user_id)

  const pushTitle = overrides?.title?.trim()
    ? sanitizeText(overrides.title.trim())
    : notification.title
  const pushBody = overrides?.body?.trim()
    ? sanitizeText(overrides.body.trim())
    : notification.body

  // Web push (fire-and-forget)
  pushService
    .sendToUsers(env, targetUserIds, {
      title: pushTitle,
      body: pushBody,
      category: notification.category,
    })
    .catch(() => {})

  return { notification, targetCount: targetUserIds.length }
}

/**
 * Load a single notification (shape only — no per-user read state). Used by the
 * compose/reminder flow to pre-fill a form from a previous notification.
 */
export async function getById(db: Db, notificationId: string) {
  const notification = await db.query.notifications.findFirst({
    where: eq(notifications.id, notificationId),
    with: { sender: { columns: { id: true, name: true } } },
  })
  return notification ?? null
}

/**
 * Lightweight user lookup for the "send to a specific user" picker. Returns
 * active, non-deleted users matching the search term (name or email), capped.
 */
export async function searchRecipients(
  db: Db,
  search: string | undefined,
  limit = 20,
): Promise<RecipientSummary[]> {
  const term = search?.trim()
  const conditions = [eq(users.is_active, true), isNull(users.deleted_at)]
  if (term) {
    conditions.push(or(like(users.name, `%${term}%`), like(users.email, `%${term}%`))!)
  }

  const rows = await db.query.users.findMany({
    where: and(...conditions),
    columns: { id: true, name: true, email: true },
    with: { flat: { columns: { block: true, floor: true, unit_number: true } } },
    orderBy: asc(users.name),
    limit,
  })

  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    flatLabel: u.flat ? `${u.flat.block}-${u.flat.floor}-${u.flat.unit_number}` : null,
  }))
}

export async function listForUser(
  db: Db,
  userId: string,
  filters: ListNotificationFilters,
): Promise<PaginatedResponse<Record<string, unknown>>> {
  const { offset, limit } = parsePagination(filters)
  const page = Number(filters.page) || 1

  const conditions = [eq(userNotifications.user_id, userId)]
  if (filters.unreadOnly) {
    conditions.push(eq(userNotifications.is_read, false))
  }
  const where = and(...conditions)

  // A core join is used instead of the relational query API because the source
  // orders by notification.created_at DESC — a *joined* column, which Drizzle's
  // relational `orderBy` cannot target (user_notifications has no timestamp).
  // The nested `{ notification: { sender } }` shape is rebuilt below by hand.
  const rows = await db
    .select({
      userNotification: userNotifications,
      notification: notifications,
      sender: { id: users.id, name: users.name },
    })
    .from(userNotifications)
    .innerJoin(notifications, eq(userNotifications.notification_id, notifications.id))
    .leftJoin(users, eq(notifications.sender_id, users.id))
    .where(where)
    .orderBy(desc(notifications.created_at))
    .limit(limit)
    .offset(offset)

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userNotifications)
    .where(where)

  const data = rows.map((r) => ({
    ...r.userNotification,
    notification: { ...r.notification, sender: r.sender },
  }))

  return paginatedResponse(data, Number(count), page, limit)
}

export async function markAsRead(db: Db, notificationId: string, userId: string) {
  const userNotification = await db.query.userNotifications.findFirst({
    where: and(eq(userNotifications.id, notificationId), eq(userNotifications.user_id, userId)),
    with: { notification: true },
  })

  if (!userNotification) {
    throw new HttpError(404, 'Notification not found')
  }

  const readAt = new Date().toISOString()
  await db
    .update(userNotifications)
    .set({ is_read: true, read_at: readAt })
    .where(eq(userNotifications.id, notificationId))

  return { ...userNotification, is_read: true, read_at: readAt }
}

export async function markAllAsRead(db: Db, userId: string): Promise<void> {
  await db
    .update(userNotifications)
    .set({ is_read: true, read_at: new Date().toISOString() })
    .where(and(eq(userNotifications.user_id, userId), eq(userNotifications.is_read, false)))
}
