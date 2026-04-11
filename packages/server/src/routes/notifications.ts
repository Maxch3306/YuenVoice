import type { FastifyInstance } from 'fastify'
import * as notificationService from '../services/notification.service.js'
import * as pushService from '../services/push.service.js'

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
    },
    async (request, reply) => {
      await pushService.unsubscribe(fastify.redis, request.user.id)
      return { message: 'Unsubscribed' }
    }
  )
}
