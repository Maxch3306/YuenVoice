import { Op } from 'sequelize'
import type Redis from 'ioredis'
import { Notification, UserNotification, User, Flat } from '../models/index.js'
import { parsePagination, paginatedResponse, type PaginatedResponse } from '../utils/pagination.js'
import * as pushService from './push.service.js'
import { sanitizeText } from '../utils/sanitize.js'

export interface SendNotificationData {
  title: string
  body: string
  category: 'urgent' | 'general' | 'event'
  targetType: 'all' | 'block' | 'floor'
  targetBlock?: string
  targetFloor?: string
}

export interface ListNotificationFilters {
  page?: string | number
  limit?: string | number
  unreadOnly?: boolean
}

export async function send(
  senderId: string,
  data: SendNotificationData,
  redis: Redis
): Promise<{ notification: Notification; targetCount: number }> {
  // 1. Create Notification record
  const notification = await Notification.create({
    sender_id: senderId,
    title: sanitizeText(data.title),
    body: sanitizeText(data.body),
    category: data.category,
    target_type: data.targetType,
    target_block: data.targetBlock ?? null,
    target_floor: data.targetFloor ?? null,
  })

  // 2. Resolve target users
  const userWhere: Record<string, unknown> = { is_active: true }
  let includeFlat = false
  const flatWhere: Record<string, unknown> = {}

  if (data.targetType === 'block' && data.targetBlock) {
    includeFlat = true
    flatWhere.block = data.targetBlock
  } else if (data.targetType === 'floor' && data.targetBlock && data.targetFloor) {
    includeFlat = true
    flatWhere.block = data.targetBlock
    flatWhere.floor = data.targetFloor
  }

  const include = includeFlat
    ? [{ model: Flat, as: 'flat', where: flatWhere, required: true }]
    : []

  const targetUsers = await User.findAll({
    where: userWhere,
    include,
    attributes: ['id'],
  })

  const targetUserIds = targetUsers.map((u) => u.id)

  // 3. Bulk create UserNotification rows
  if (targetUserIds.length > 0) {
    const rows = targetUserIds.map((userId) => ({
      notification_id: notification.id,
      user_id: userId,
    }))
    await UserNotification.bulkCreate(rows)
  }

  // 4. Publish to Redis pub/sub for each target (fire-and-forget)
  for (const userId of targetUserIds) {
    redis
      .publish(
        `notify:user:${userId}`,
        JSON.stringify({
          id: notification.id,
          title: notification.title,
          body: notification.body,
          category: notification.category,
        })
      )
      .catch(() => {})
  }

  // 5. Send Web Push (fire-and-forget)
  pushService
    .sendToUsers(redis, targetUserIds, {
      title: notification.title,
      body: notification.body,
      category: notification.category,
    })
    .catch(() => {})

  return { notification, targetCount: targetUserIds.length }
}

export async function listForUser(
  userId: string,
  filters: ListNotificationFilters
): Promise<PaginatedResponse<UserNotification>> {
  const { offset, limit } = parsePagination(filters)
  const page = Number(filters.page) || 1

  const where: Record<string, unknown> = { user_id: userId }
  if (filters.unreadOnly) {
    where.is_read = false
  }

  const { rows, count } = await UserNotification.findAndCountAll({
    where,
    include: [
      {
        model: Notification,
        as: 'notification',
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'name'],
          },
        ],
      },
    ],
    order: [[{ model: Notification, as: 'notification' }, 'created_at', 'DESC']],
    offset,
    limit,
  })

  return paginatedResponse(rows, count, page, limit)
}

export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<UserNotification> {
  const userNotification = await UserNotification.findOne({
    where: {
      id: notificationId,
      user_id: userId,
    },
    include: [
      {
        model: Notification,
        as: 'notification',
      },
    ],
  })

  if (!userNotification) {
    throw Object.assign(new Error('Notification not found'), { statusCode: 404 })
  }

  userNotification.is_read = true
  userNotification.read_at = new Date()
  await userNotification.save()

  return userNotification
}

export async function markAllAsRead(userId: string): Promise<void> {
  await UserNotification.update(
    { is_read: true, read_at: new Date() },
    { where: { user_id: userId, is_read: false } }
  )
}
