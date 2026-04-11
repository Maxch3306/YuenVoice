import { Op, fn, col, literal } from 'sequelize'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { User, Flat, AuditLog, IncidentReport, DiscussionPost, OcDocument } from '../models/index.js'
import { parsePagination, paginatedResponse } from '../utils/pagination.js'
import { logAudit } from '../utils/audit.js'
import { randomBytes } from 'node:crypto'

const ROLES = ['resident', 'oc_committee', 'mgmt_staff', 'admin'] as const

export default async function adminRoutes(fastify: FastifyInstance) {
  // All admin routes require authenticate + rbac(['admin'])
  fastify.addHook('preHandler', fastify.authenticate)
  fastify.addHook('preHandler', fastify.rbac(['admin']))

  // GET /api/admin/stats — dashboard statistics
  fastify.get('/api/admin/stats', async () => {
    const [totalUsers, openReports, postsThisWeek, totalDocuments] = await Promise.all([
      User.count({ where: { is_active: true } }),
      IncidentReport.count({ where: { status: { [Op.in]: ['pending', 'in_progress'] } } }),
      DiscussionPost.count({
        where: {
          created_at: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      OcDocument.count(),
    ])
    return { totalUsers, openReports, postsThisWeek, totalDocuments }
  })

  // GET /api/admin/users — list users (paginated, search, filter by role)
  fastify.get(
    '/api/admin/users',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            role: { type: 'string', enum: [...ROLES] },
            search: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: { page?: number; limit?: number; role?: string; search?: string }
      }>,
      reply: FastifyReply
    ) => {
      const { offset, limit } = parsePagination(request.query)
      const page = Number(request.query.page) || 1

      const where: Record<string, unknown> = {}
      if (request.query.role) {
        where.role = request.query.role
      }
      if (request.query.search) {
        const search = `%${request.query.search}%`
        where[Op.or as any] = [
          { name: { [Op.iLike]: search } },
          { email: { [Op.iLike]: search } },
        ]
      }

      const { rows, count } = await User.findAndCountAll({
        where,
        include: [
          {
            model: Flat,
            as: 'flat',
            attributes: ['id', 'block', 'floor', 'unit_number'],
          },
        ],
        attributes: { exclude: ['password_hash'] },
        order: [['created_at', 'DESC']],
        offset,
        limit,
      })

      return paginatedResponse(rows, count, page, limit)
    }
  )

  // PATCH /api/admin/users/:id/role — update role
  fastify.patch(
    '/api/admin/users/:id/role',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: [...ROLES] },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string }
        Body: { role: string }
      }>,
      reply: FastifyReply
    ) => {
      const user = await User.findByPk(request.params.id, {
        attributes: { exclude: ['password_hash'] },
      })
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      const oldRole = user.role
      user.role = request.body.role as any
      await user.save()

      await logAudit(request.user.id, 'update_role', 'user', user.id, {
        oldRole,
        newRole: request.body.role,
      })

      return user
    }
  )

  // PATCH /api/admin/users/:id/status — activate/deactivate
  fastify.patch(
    '/api/admin/users/:id/status',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['isActive'],
          properties: {
            isActive: { type: 'boolean' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string }
        Body: { isActive: boolean }
      }>,
      reply: FastifyReply
    ) => {
      const user = await User.findByPk(request.params.id, {
        attributes: { exclude: ['password_hash'] },
      })
      if (!user) {
        return reply.status(404).send({ error: 'User not found' })
      }

      const oldStatus = user.is_active
      user.is_active = request.body.isActive
      await user.save()

      await logAudit(request.user.id, 'update_status', 'user', user.id, {
        oldStatus,
        newStatus: request.body.isActive,
      })

      return user
    }
  )

  // GET /api/admin/flats/blocks — distinct block values
  fastify.get('/api/admin/flats/blocks', async () => {
    const rows = await Flat.findAll({
      attributes: [[fn('DISTINCT', col('block')), 'block']],
      order: [['block', 'ASC']],
      raw: true,
    })
    return rows.map((r: any) => r.block)
  })

  // GET /api/admin/flats — list flats (paginated, filter by block, include resident count)
  fastify.get(
    '/api/admin/flats',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            block: { type: 'string' },
            search: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: { page?: number; limit?: number; block?: string; search?: string }
      }>,
      reply: FastifyReply
    ) => {
      const { offset, limit } = parsePagination(request.query)
      const page = Number(request.query.page) || 1

      const where: Record<string, unknown> = {}
      if (request.query.block) {
        where.block = request.query.block
      }
      if (request.query.search) {
        const search = `%${request.query.search}%`
        where[Op.or as any] = [
          { block: { [Op.iLike]: search } },
          { floor: { [Op.iLike]: search } },
          { unit_number: { [Op.iLike]: search } },
        ]
      }

      const { rows, count } = await Flat.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: 'residents',
            attributes: ['id'],
          },
        ],
        order: [['block', 'ASC'], ['floor', 'ASC'], ['unit_number', 'ASC']],
        offset,
        limit,
        distinct: true,
      })

      // Transform to include resident count
      const data = rows.map((flat) => {
        const json = flat.toJSON() as any
        json.residentCount = json.residents?.length ?? 0
        delete json.residents
        return json
      })

      return paginatedResponse(data, count, page, limit)
    }
  )

  // GET /api/admin/flats/export-csv — export all flats as CSV
  fastify.get(
    '/api/admin/flats/export-csv',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            block: { type: 'string' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: { block?: string } }>,
      reply: FastifyReply
    ) => {
      const where: Record<string, unknown> = {}
      if (request.query.block) {
        where.block = request.query.block
      }

      const flats = await Flat.findAll({
        where,
        order: [['block', 'ASC'], ['floor', 'ASC'], ['unit_number', 'ASC']],
      })

      const BOM = '\uFEFF'
      const header = '座,樓層,單位,註冊密碼,註冊狀態'
      const rows = flats.map((f) =>
        `${f.block},${f.floor},${f.unit_number},${f.registration_password},${f.is_registration_open ? '開放' : '關閉'}`
      )
      const csv = BOM + [header, ...rows].join('\n')

      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="flats-${new Date().toISOString().slice(0, 10)}.csv"`)
        .send(csv)
    }
  )

  // POST /api/admin/flats — create a new flat
  fastify.post(
    '/api/admin/flats',
    {
      schema: {
        body: {
          type: 'object',
          required: ['block', 'floor', 'unitNumber'],
          properties: {
            block: { type: 'string', minLength: 1 },
            floor: { type: 'string', minLength: 1 },
            unitNumber: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { block, floor, unitNumber } = request.body as {
        block: string
        floor: string
        unitNumber: string
      }

      // Check for duplicate
      const existing = await Flat.findOne({
        where: { block, floor, unit_number: unitNumber },
      })
      if (existing) {
        return reply.status(409).send({ error: '此單位已存在' })
      }

      // Generate registration password
      const password = randomBytes(4).toString('hex').toUpperCase()

      const flat = await Flat.create({
        block,
        floor,
        unit_number: unitNumber,
        registration_password: password,
        is_registration_open: true,
      })

      await logAudit(request.user.id, 'create_flat', 'flat', flat.id, {
        block,
        floor,
        unit_number: unitNumber,
      })

      const json = flat.toJSON() as any
      return reply.status(201).send(json)
    }
  )

  // PATCH /api/admin/flats/:id — update flat details
  fastify.patch(
    '/api/admin/flats/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            block: { type: 'string', minLength: 1 },
            floor: { type: 'string', minLength: 1 },
            unitNumber: { type: 'string', minLength: 1 },
            isRegistrationOpen: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = request.body as {
        block?: string
        floor?: string
        unitNumber?: string
        isRegistrationOpen?: boolean
      }

      const flat = await Flat.findByPk(id)
      if (!flat) {
        return reply.status(404).send({ error: 'Flat not found' })
      }

      const changes: Record<string, unknown> = {}
      if (body.block !== undefined) {
        changes.old_block = flat.block
        flat.block = body.block
      }
      if (body.floor !== undefined) {
        changes.old_floor = flat.floor
        flat.floor = body.floor
      }
      if (body.unitNumber !== undefined) {
        changes.old_unit_number = flat.unit_number
        flat.unit_number = body.unitNumber
      }
      if (body.isRegistrationOpen !== undefined) {
        changes.old_is_registration_open = flat.is_registration_open
        flat.is_registration_open = body.isRegistrationOpen
      }

      await flat.save()

      await logAudit(request.user.id, 'update_flat', 'flat', flat.id, changes)

      const json = flat.toJSON() as any
      return json
    }
  )

  // DELETE /api/admin/flats/:id — delete a flat
  fastify.delete(
    '/api/admin/flats/:id',
    {
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

      const flat = await Flat.findByPk(id, {
        include: [{ model: User, as: 'residents', attributes: ['id'] }],
      })
      if (!flat) {
        return reply.status(404).send({ error: 'Flat not found' })
      }

      const residents = (flat as any).residents ?? []
      if (residents.length > 0) {
        return reply.status(400).send({
          error: '無法刪除此單位，尚有已註冊住戶',
          residentCount: residents.length,
        })
      }

      await logAudit(request.user.id, 'delete_flat', 'flat', flat.id, {
        block: flat.block,
        floor: flat.floor,
        unit_number: flat.unit_number,
      })

      await flat.destroy()
      return { message: '單位已刪除' }
    }
  )

  // POST /api/admin/flats/:id/reset-password — generate new registration password
  fastify.post(
    '/api/admin/flats/:id/reset-password',
    {
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
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const flat = await Flat.findByPk(request.params.id)
      if (!flat) {
        return reply.status(404).send({ error: 'Flat not found' })
      }

      // Generate a random 8-character alphanumeric password
      const newPassword = randomBytes(4).toString('hex').toUpperCase()

      flat.registration_password = newPassword
      await flat.save()

      await logAudit(request.user.id, 'reset_password', 'flat', flat.id, {
        block: flat.block,
        floor: flat.floor,
        unit_number: flat.unit_number,
      })

      return { newPassword }
    }
  )

  // GET /api/admin/audit-logs — list audit logs (paginated, filterable)
  fastify.get(
    '/api/admin/audit-logs',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            userId: { type: 'string', format: 'uuid' },
            action: { type: 'string' },
            entityType: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Querystring: {
          page?: number
          limit?: number
          userId?: string
          action?: string
          entityType?: string
          startDate?: string
          endDate?: string
        }
      }>,
      reply: FastifyReply
    ) => {
      const { offset, limit } = parsePagination(request.query)
      const page = Number(request.query.page) || 1

      const where: Record<string, unknown> = {}
      if (request.query.userId) where.user_id = request.query.userId
      if (request.query.action) where.action = request.query.action
      if (request.query.entityType) where.entity_type = request.query.entityType

      if (request.query.startDate || request.query.endDate) {
        const dateFilter: Record<symbol, unknown> = {}
        if (request.query.startDate) {
          dateFilter[Op.gte] = new Date(request.query.startDate)
        }
        if (request.query.endDate) {
          // Include the full end date by setting to end of day
          const endDate = new Date(request.query.endDate)
          endDate.setHours(23, 59, 59, 999)
          dateFilter[Op.lte] = endDate
        }
        where.created_at = dateFilter
      }

      const { rows, count } = await AuditLog.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email'],
          },
        ],
        order: [['created_at', 'DESC']],
        offset,
        limit,
      })

      return paginatedResponse(rows, count, page, limit)
    }
  )
}
