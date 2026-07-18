import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppBindings } from '../../env.js'
import { getDb } from '../../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import * as notificationService from '../services/notifications.js'
import * as pushService from '../services/push.js'

// Composing/sending is mgmt/admin; listing + marking-read is any authed user;
// the recipient picker is mgmt/admin.
const mgmtRoles = ['mgmt_staff', 'admin'] as const

const recipientsQuery = z.object({ search: z.string().optional() })

const sendBody = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  category: z.enum(['urgent', 'general', 'event']),
  targetType: z.enum(['all', 'block', 'floor', 'user']),
  targetBlock: z.string().optional(),
  targetFloor: z.string().optional(),
  targetUserId: z.string().uuid().optional(),
})

const resendBody = z.object({
  title: z.string().max(200).optional(),
  body: z.string().max(2000).optional(),
})

const listQuery = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  unreadOnly: z.string().optional(),
})

const notifications = new Hono<AppBindings>()
notifications.use('*', requireAuth())

// GET /api/notifications/recipients — user picker for individual reminders (mgmt/admin)
notifications.get('/recipients', requireRole(...mgmtRoles), zValidator('query', recipientsQuery), async (c) => {
  const db = getDb(c.env.DB)
  return c.json(await notificationService.searchRecipients(db, c.req.valid('query').search))
})

// POST /api/notifications — send targeted notification (mgmt/admin)
notifications.post('/', requireRole(...mgmtRoles), zValidator('json', sendBody), async (c) => {
  const db = getDb(c.env.DB)
  const body = c.req.valid('json')
  const { targetType, targetBlock, targetFloor, targetUserId } = body

  if (targetType === 'block' && !targetBlock) {
    return c.json({ error: 'targetBlock is required when targetType is block' }, 400)
  }
  if (targetType === 'floor' && (!targetBlock || !targetFloor)) {
    return c.json({ error: 'targetBlock and targetFloor are required when targetType is floor' }, 400)
  }
  if (targetType === 'user' && !targetUserId) {
    return c.json({ error: 'targetUserId is required when targetType is user' }, 400)
  }

  const result = await notificationService.send(db, c.env, c.get('user')!.id, body)
  return c.json({ ...result.notification, targetCount: result.targetCount }, 201)
})

// POST /api/notifications/:id/resend — re-push existing notification (mgmt/admin).
// No new Notification row is created; web push fires again.
notifications.post('/:id/resend', requireRole(...mgmtRoles), zValidator('json', resendBody), async (c) => {
  const db = getDb(c.env.DB)
  const result = await notificationService.resend(db, c.env, c.req.param('id'), c.req.valid('json'))
  return c.json({ id: result.notification.id, targetCount: result.targetCount })
})

// GET /api/notifications/:id — single notification (mgmt/admin, for compose prefill)
notifications.get('/:id', requireRole(...mgmtRoles), async (c) => {
  const db = getDb(c.env.DB)
  const notification = await notificationService.getById(db, c.req.param('id'))
  if (!notification) return c.json({ error: 'Notification not found' }, 404)
  return c.json(notification)
})

// GET /api/notifications — current user's notifications (paginated)
notifications.get('/', zValidator('query', listQuery), async (c) => {
  const db = getDb(c.env.DB)
  const q = c.req.valid('query')
  return c.json(
    await notificationService.listForUser(db, c.get('user')!.id, {
      page: q.page,
      limit: q.limit,
      unreadOnly: q.unreadOnly === 'true',
    }),
  )
})

// PATCH /api/notifications/read-all — mark all as read (registered before :id/read)
notifications.patch('/read-all', async (c) => {
  const db = getDb(c.env.DB)
  await notificationService.markAllAsRead(db, c.get('user')!.id)
  return c.json({ message: 'All notifications marked as read' })
})

// PATCH /api/notifications/:id/read — mark as read (user can only mark own)
notifications.patch('/:id/read', async (c) => {
  const db = getDb(c.env.DB)
  const updated = await notificationService.markAsRead(db, c.req.param('id'), c.get('user')!.id)
  return c.json(updated)
})

export default notifications

// ── Push subscription endpoints ────────────────────────────────────────────
// In the Fastify build these lived in the notifications route file but under the
// `/api/push` prefix. Because this default export is mounted at
// `/api/notifications`, they cannot share the mount — they are exported here as
// a separate router meant to be mounted at `/api/push` in http/app.ts
// (`app.route('/api/push', push)`).

const subscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

export const push = new Hono<AppBindings>()
push.use('*', requireAuth())

// GET /api/push/vapid-key — public VAPID key for push subscription
push.get('/vapid-key', (c) => {
  if (!c.env.VAPID_PUBLIC_KEY) return c.json({ error: 'Push not configured' }, 503)
  return c.json({ key: c.env.VAPID_PUBLIC_KEY })
})

// POST /api/push/subscribe — store push subscription
push.post('/subscribe', zValidator('json', subscribeBody), async (c) => {
  await pushService.subscribe(c.env, c.get('user')!.id, c.req.valid('json'))
  return c.json({ message: 'Subscribed' })
})

// DELETE /api/push/subscribe — remove push subscription
push.delete('/subscribe', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { endpoint?: string }
  await pushService.unsubscribe(c.env, c.get('user')!.id, body?.endpoint)
  return c.json({ message: 'Unsubscribed' })
})

// POST /api/push/test — send a test push notification to the current user
push.post('/test', async (c) => {
  const userId = c.get('user')!.id
  try {
    const sent = await pushService.sendToUser(c.env, userId, {
      title: 'YUENVOICE 測試',
      body: '推送通知測試成功！',
      url: '/',
    })
    if (sent === 0) {
      return c.json({ error: '尚未訂閱推送通知，請先允許通知權限' }, 400)
    }
    return c.json({ message: `Test push sent to ${sent} device(s)` })
  } catch (err) {
    console.error('Push test failed', err)
    return c.json({ error: `推送失敗: ${err instanceof Error ? err.message : 'unknown error'}` }, 500)
  }
})
