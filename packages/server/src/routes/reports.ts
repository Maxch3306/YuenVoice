import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as reportService from '../services/report.service.js'
import { writeRateLimit } from '../middleware/rate-limit.js'

// ── JSON Schemas ──

const reportTypeEnum = ['repair', 'complaint', 'inquiry'] as const
const statusEnum = ['pending', 'in_progress', 'completed'] as const

const createReportSchema = {
  body: {
    type: 'object' as const,
    required: ['title', 'type', 'description'],
    properties: {
      title: { type: 'string' as const, maxLength: 200, minLength: 1 },
      type: { type: 'string' as const, enum: reportTypeEnum },
      description: { type: 'string' as const, maxLength: 5000, minLength: 1 },
      locationBlock: { type: 'string' as const, nullable: true },
      locationFloor: { type: 'string' as const, nullable: true },
      locationArea: { type: 'string' as const, nullable: true },
    },
    additionalProperties: false,
  },
}

const listReportsSchema = {
  querystring: {
    type: 'object' as const,
    properties: {
      status: { type: 'string' as const, enum: statusEnum },
      type: { type: 'string' as const, enum: reportTypeEnum },
      page: { type: 'string' as const },
      limit: { type: 'string' as const },
      startDate: { type: 'string' as const, format: 'date' },
      endDate: { type: 'string' as const, format: 'date' },
    },
    additionalProperties: false,
  },
}

const reportIdParamsSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
}

const updateStatusSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
  body: {
    type: 'object' as const,
    required: ['status'],
    properties: {
      status: { type: 'string' as const, enum: statusEnum },
    },
    additionalProperties: false,
  },
}

const addCommentSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
  body: {
    type: 'object' as const,
    required: ['content'],
    properties: {
      content: { type: 'string' as const, minLength: 1, maxLength: 5000 },
      isInternal: { type: 'boolean' as const },
    },
    additionalProperties: false,
  },
}

const attachmentsParamsSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const, format: 'uuid' },
    },
  },
}

// ── Request Types ──

interface CreateReportBody {
  title: string
  type: 'repair' | 'complaint' | 'inquiry'
  description: string
  locationBlock?: string
  locationFloor?: string
  locationArea?: string
}

interface ListReportsQuery {
  status?: string
  type?: string
  page?: string
  limit?: string
  startDate?: string
  endDate?: string
}

interface ReportIdParams {
  id: string
}

interface UpdateStatusBody {
  status: 'pending' | 'in_progress' | 'completed'
}

interface AddCommentBody {
  content: string
  isInternal?: boolean
}

// ── Route Plugin ──

export default async function reportRoutes(fastify: FastifyInstance) {
  const reporterRoles = ['resident', 'mgmt_staff', 'admin']
  const mgmtRoles = ['mgmt_staff', 'admin']

  // POST /api/reports — create report (multipart: fields + optional attachments)
  // oc_committee cannot file tickets — committee role is review-only.
  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate, fastify.rbac(reporterRoles)],
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parts = request.parts()
      const fields: Record<string, string> = {}
      const files: { buffer: Buffer; mimetype: string; filename: string }[] = []

      for await (const part of parts) {
        if (part.type === 'field') {
          fields[part.fieldname] = (part as any).value as string
        } else if (part.type === 'file') {
          const buffer = await part.toBuffer()
          files.push({ buffer, mimetype: part.mimetype, filename: part.filename })
        }
      }

      // Validate required fields
      if (!fields.title || fields.title.length > 200) {
        return reply.status(400).send({ error: 'Bad Request', message: 'title is required (max 200 chars)' })
      }
      if (!fields.type || !['repair', 'complaint', 'inquiry'].includes(fields.type)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'type must be repair, complaint, or inquiry' })
      }
      if (!fields.description || fields.description.length > 5000) {
        return reply.status(400).send({ error: 'Bad Request', message: 'description is required (max 5000 chars)' })
      }

      const report = await reportService.create(request.user.id, {
        title: fields.title,
        type: fields.type as 'repair' | 'complaint' | 'inquiry',
        description: fields.description,
        locationBlock: fields.locationBlock || null,
        locationFloor: fields.locationFloor || null,
        locationArea: fields.locationArea || null,
      })

      // Save attachments if any
      if (files.length > 0) {
        await reportService.addAttachments(report.id, files)
      }

      return reply.status(201).send(report)
    }
  )

  // GET /api/reports — list reports
  fastify.get<{ Querystring: ListReportsQuery }>(
    '/',
    {
      schema: listReportsSchema,
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const { id: userId, role } = request.user
      return reportService.list(userId, role, request.query)
    }
  )

  // GET /api/reports/:id — report detail
  fastify.get<{ Params: ReportIdParams }>(
    '/:id',
    {
      schema: reportIdParamsSchema,
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id: userId, role } = request.user
      const result = await reportService.getById(request.params.id, userId, role)

      if (!result) {
        return reply.status(404).send({ error: 'Report not found' })
      }
      if ('forbidden' in result) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      return result
    }
  )

  // PATCH /api/reports/:id/status — update status (mgmt/admin only)
  fastify.patch<{ Params: ReportIdParams; Body: UpdateStatusBody }>(
    '/:id/status',
    {
      schema: updateStatusSchema,
      preHandler: [fastify.authenticate, fastify.rbac(mgmtRoles)],
    },
    async (request, reply) => {
      const report = await reportService.updateStatus(
        request.params.id,
        request.body.status,
        request.user.id
      )

      if (!report) {
        return reply.status(404).send({ error: 'Report not found' })
      }

      return report
    }
  )

  // POST /api/reports/:id/comments — add comment
  fastify.post<{ Params: ReportIdParams; Body: AddCommentBody }>(
    '/:id/comments',
    {
      schema: addCommentSchema,
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { id: userId, role } = request.user
      const { content, isInternal } = request.body

      const comment = await reportService.addComment(
        request.params.id,
        userId,
        role,
        content,
        isInternal ?? false
      )

      if (!comment) {
        return reply.status(404).send({ error: 'Report not found' })
      }

      return reply.status(201).send(comment)
    }
  )

  // POST /api/reports/:id/attachments — upload attachments
  fastify.post<{ Params: ReportIdParams }>(
    '/:id/attachments',
    {
      schema: attachmentsParamsSchema,
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const parts = request.files()
      const files = []
      for await (const part of parts) {
        const buffer = await part.toBuffer()
        files.push({ buffer, mimetype: part.mimetype, filename: part.filename })
      }

      if (files.length === 0) {
        return reply.status(400).send({ error: 'No files provided' })
      }

      if (files.length > 5) {
        return reply.status(400).send({ error: 'Maximum 5 files allowed' })
      }

      const attachments = await reportService.addAttachments(
        request.params.id,
        files
      )

      if (!attachments) {
        return reply.status(404).send({ error: 'Report not found' })
      }

      return reply.status(201).send(attachments)
    }
  )
}
