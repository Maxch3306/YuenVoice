import type { FastifyInstance } from 'fastify'
import * as notificationService from '../services/notification.service.js'
import * as pushService from '../services/push.service.js'
import { config } from '../config/index.js'

const CATEGORIES = ['urgent', 'general', 'event'] as const
const TARGET_TYPES = ['all', 'block', 'floor'] as const

export default async function notificationRoutes(fastify: FastifyInstance) {
  // POST /api/notifications — send targeted notification (mgmt/admin)
  fastify.post(
    '/api/notifications',
    {
      preHandler: [fastify.authenticate, fastify.rbac(['mgmt_staff', 'admin'])],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
      schema: {
        body: {
          type: 'object',
          required: ['title', 'body', 'category', 'targetType'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            body: { type: 'string', minLength: 1 },
            category: { type: 'string', enum: [...CATEGORIES] },
            targetType: { type: 'string', enum: [...TARGET_TYPES] },
            targetBlock: { type: 'string' },
            targetFloor: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        title: string
        body: string
        category: 'urgent' | 'general' | 'event'
        targetType: 'all' | 'block' | 'floor'
        targetBlock?: string
        targetFloor?: string
      }
      const { targetType, targetBlock, targetFloor } = body

      if (targetType === 'block' && !targetBlock) {
        return reply.status(400).send({ error: 'targetBlock is required when targetType is block' })
      }
      if (targetType === 'floor' && (!targetBlock || !targetFloor)) {
        return reply
          .status(400)
          .send({ error: 'targetBlock and targetFloor are required when targetType is floor' })
      }

      const result = await notificationService.send(request.user.id, body, fastify.redis)

      return reply.status(201).send({
        ...result.notification.toJSON(),
        targetCount: result.targetCount,
      })
    }
  )

  // POST /api/notifications/:id/resend — re-push existing notification (mgmt/admin)
  // No new Notification row is created; web push + realtime ping fire again.
  fastify.post(
    '/api/notifications/:id/resend',
    {
      preHandler: [fastify.authenticate, fastify.rbac(['mgmt_staff', 'admin'])],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', maxLength: 200 },
            body: { type: 'string', maxLength: 2000 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as { title?: string; body?: string } | undefined
      const result = await notificationService.resend(id, body, fastify.redis)
      return reply.send({
        id: result.notification.id,
        targetCount: result.targetCount,
      })
    },
  )

  // GET /api/notifications/:id — single notification (mgmt/admin, for compose prefill)
  fastify.get(
    '/api/notifications/:id',
    {
      preHandler: [fastify.authenticate, fastify.rbac(['mgmt_staff', 'admin'])],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const notification = await notificationService.getById(id)
      if (!notification) {
        return reply.status(404).send({ error: 'Notification not found' })
      }
      return notification
    },
  )

  // GET /api/notifications — current user's notifications (paginated)
  fastify.get(
    '/api/notifications',
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            unreadOnly: { type: 'boolean', default: false },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as { page?: number; limit?: number; unreadOnly?: boolean }
      const result = await notificationService.listForUser(request.user.id, {
        page: query.page,
        limit: query.limit,
        unreadOnly: query.unreadOnly,
      })
      return result
    }
  )

  // PATCH /api/notifications/read-all — mark all as read (must be before :id/read)
  fastify.patch(
    '/api/notifications/read-all',
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      await notificationService.markAllAsRead(request.user.id)
      return { message: 'All notifications marked as read' }
    }
  )

  // PATCH /api/notifications/:id/read — mark as read (user can only mark own)
  fastify.patch(
    '/api/notifications/:id/read',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const updated = await notificationService.markAsRead(id, request.user.id)
      return updated
    }
  )

  // GET /api/push/vapid-key — public VAPID key for push subscription
  fastify.get(
    '/api/push/vapid-key',
    {
      preHandler: [fastify.authenticate],
    },
    async (_request, reply) => {
      if (!config.vapidPublicKey) {
        return reply.status(503).send({ error: 'Push not configured' })
      }
      return { key: config.vapidPublicKey }
    }
  )

  // POST /api/push/subscribe — store push subscription
  fastify.post(
    '/api/push/subscribe',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['endpoint', 'keys'],
          properties: {
            endpoint: { type: 'string', format: 'uri' },
            keys: {
              type: 'object',
              required: ['p256dh', 'auth'],
              properties: {
                p256dh: { type: 'string', minLength: 1 },
                auth: { type: 'string', minLength: 1 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { endpoint: string; keys: { p256dh: string; auth: string } }
      await pushService.subscribe(fastify.redis, request.user.id, body)
      return { message: 'Subscribed' }
    }
  )

  // DELETE /api/push/subscribe — remove push subscription
  fastify.delete(
    '/api/push/subscribe',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          properties: {
            endpoint: { type: 'string', format: 'uri' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { endpoint?: string } | undefined
      await pushService.unsubscribe(fastify.redis, request.user.id, body?.endpoint)
      return { message: 'Unsubscribed' }
    }
  )

  // POST /api/push/test — send a test push notification to the current user
  fastify.post(
    '/api/push/test',
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id

      try {
        const sent = await pushService.sendToUser(
          fastify.redis,
          userId,
          { title: 'YUENVOICE 測試', body: '推送通知測試成功！', url: '/' }
        )
        if (sent === 0) {
          return reply.status(400).send({ error: '尚未訂閱推送通知，請先允許通知權限' })
        }
        return { message: `Test push sent to ${sent} device(s)` }
      } catch (err: any) {
        request.log.error(err, 'Push test failed')
        return reply.status(500).send({ error: `推送失敗: ${err?.message ?? 'unknown error'}` })
      }
    }
  )
}
