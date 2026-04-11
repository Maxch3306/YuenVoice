import type { FastifyInstance } from 'fastify'
import { config } from '../config/index.js'
import { parsePagination, paginatedResponse } from '../utils/pagination.js'
import * as discussionService from '../services/discussion.service.js'

// ── JSON Schemas ──

const idParamsSchema = {
  type: 'object' as const,
  required: ['id'],
  properties: {
    id: { type: 'string' as const, format: 'uuid' },
  },
}

const paginationQuerySchema = {
  type: 'object' as const,
  properties: {
    page: { type: 'string' as const },
    limit: { type: 'string' as const },
  },
}

const commentBodySchema = {
  type: 'object' as const,
  required: ['content'],
  properties: {
    content: { type: 'string' as const, minLength: 1, maxLength: 2000 },
    isAnonymous: { type: 'boolean' as const, default: false },
  },
  additionalProperties: false,
}

const reactionBodySchema = {
  type: 'object' as const,
  required: ['type'],
  properties: {
    type: { type: 'string' as const, enum: ['like'] as const },
  },
  additionalProperties: false,
}

const reportBodySchema = {
  type: 'object' as const,
  properties: {
    reason: { type: 'string' as const, maxLength: 500 },
  },
  additionalProperties: false,
}

const moderateBodySchema = {
  type: 'object' as const,
  required: ['action'],
  properties: {
    action: { type: 'string' as const, enum: ['hide', 'pin', 'unpin', 'delete'] as const },
  },
  additionalProperties: false,
}

// ── Request Types ──

interface IdParams {
  id: string
}

interface PaginationQuery {
  page?: string
  limit?: string
}

interface CommentBody {
  content: string
  isAnonymous?: boolean
}

interface ReactionBody {
  type: 'like'
}

interface ReportBody {
  reason?: string
}

interface ModerateBody {
  action: 'hide' | 'pin' | 'unpin' | 'delete'
}

// ── Route Plugin ──

export default async function discussionRoutes(fastify: FastifyInstance) {
  const prefix = config.apiPrefix

  // GET /api/boards — list boards accessible to the user
  fastify.get(
    `${prefix}/boards`,
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const boards = await discussionService.listBoards(request.user.flatId)
      return reply.send({ data: boards })
    },
  )

  // GET /api/boards/:id/posts — list posts in a board (paginated)
  fastify.get<{ Params: IdParams; Querystring: PaginationQuery }>(
    `${prefix}/boards/:id/posts`,
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: idParamsSchema,
        querystring: paginationQuerySchema,
      },
    },
    async (request, reply) => {
      const { id: boardId } = request.params
      const pagination = parsePagination(request.query)
      const page = Number(request.query.page) || 1

      const { count, rows } = await discussionService.listPosts(
        boardId,
        pagination,
        request.user.role,
      )

      return reply.send(paginatedResponse(rows, count, page, pagination.limit))
    },
  )

  // POST /api/boards/:id/posts — create post (multipart)
  fastify.post<{ Params: IdParams }>(
    `${prefix}/boards/:id/posts`,
    {
      preHandler: [
        fastify.authenticate,
        fastify.rbac(['resident', 'oc_committee', 'mgmt_staff', 'admin']),
      ],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      } as any,
    },
    async (request, reply) => {
      const { id: boardId } = request.params
      const parts = request.parts()

      const fields: Record<string, string> = {}
      const files: any[] = []

      for await (const part of parts) {
        if (part.type === 'field') {
          fields[part.fieldname] = (part as any).value as string
        } else if (part.type === 'file') {
          files.push(part)
        }
      }

      // Validate required fields
      if (!fields.title || fields.title.length > 200) {
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: 'title is required and must be at most 200 characters' })
      }
      if (!fields.body || fields.body.length > 10000) {
        return reply
          .status(400)
          .send({ error: 'Bad Request', message: 'body is required and must be at most 10000 characters' })
      }

      const isAnonymous = fields.isAnonymous === 'true'

      const post = await discussionService.createPost(
        boardId,
        request.user.id,
        { title: fields.title, body: fields.body, isAnonymous },
        files,
      )

      return reply.status(201).send({ data: post })
    },
  )

  // GET /api/posts/:id — post detail
  fastify.get<{ Params: IdParams }>(
    `${prefix}/posts/:id`,
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: idParamsSchema,
      },
    },
    async (request, reply) => {
      const post = await discussionService.getPost(request.params.id, request.user.role)
      if (!post) {
        return reply.status(404).send({ error: 'Not Found', message: 'Post not found' })
      }
      return reply.send({ data: post })
    },
  )

  // POST /api/posts/:id/comments — add comment
  fastify.post<{ Params: IdParams; Body: CommentBody }>(
    `${prefix}/posts/:id/comments`,
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: idParamsSchema,
        body: commentBodySchema,
      },
    },
    async (request, reply) => {
      const comment = await discussionService.addComment(
        request.params.id,
        request.user.id,
        request.body.content,
        request.body.isAnonymous ?? false,
      )

      if (!comment) {
        return reply.status(404).send({ error: 'Not Found', message: 'Post not found' })
      }

      return reply.status(201).send({ data: comment })
    },
  )

  // POST /api/posts/:id/reactions — toggle reaction
  fastify.post<{ Params: IdParams; Body: ReactionBody }>(
    `${prefix}/posts/:id/reactions`,
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: idParamsSchema,
        body: reactionBodySchema,
      },
    },
    async (request, reply) => {
      const result = await discussionService.toggleReaction(
        request.params.id,
        request.user.id,
        request.body.type,
      )

      if (!result) {
        return reply.status(404).send({ error: 'Not Found', message: 'Post not found' })
      }

      return reply.send({ data: result })
    },
  )

  // POST /api/posts/:id/report — flag post
  fastify.post<{ Params: IdParams; Body: ReportBody }>(
    `${prefix}/posts/:id/report`,
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: idParamsSchema,
        body: reportBodySchema,
      },
    },
    async (request, reply) => {
      const result = await discussionService.flagPost(
        request.params.id,
        request.user.id,
        request.body.reason,
      )

      if (!result) {
        return reply.status(404).send({ error: 'Not Found', message: 'Post not found' })
      }

      return reply.send(result)
    },
  )

  // PATCH /api/posts/:id/moderate — moderation actions (mgmt/admin only)
  fastify.patch<{ Params: IdParams; Body: ModerateBody }>(
    `${prefix}/posts/:id/moderate`,
    {
      preHandler: [
        fastify.authenticate,
        fastify.rbac(['mgmt_staff', 'admin']),
      ],
      schema: {
        params: idParamsSchema,
        body: moderateBodySchema,
      },
    },
    async (request, reply) => {
      const result = await discussionService.moderatePost(
        request.params.id,
        request.body.action,
        request.user.id,
      )

      if (!result) {
        return reply.status(404).send({ error: 'Not Found', message: 'Post not found' })
      }

      return reply.send({ data: result })
    },
  )
}
