import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppBindings } from '../../env.js'
import { getDb } from '../../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import * as adminService from '../services/admin.js'

const ROLES = ['resident', 'oc_committee', 'mgmt_staff', 'admin'] as const

// All admin routes require a valid access token + the `admin` role (mirrors the
// Fastify `preHandler` of authenticate + rbac(['admin'])).
const admin = new Hono<AppBindings>()
admin.use('*', requireAuth(), requireRole('admin'))

// ── Validation schemas ──────────────────────────────────────────────────────

const listUsersQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  role: z.enum(ROLES).optional(),
  search: z.string().optional(),
})
const createUserBody = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(ROLES),
  flatId: z.string().uuid().optional(),
})
const roleBody = z.object({ role: z.enum(ROLES) })
const statusBody = z.object({ isActive: z.boolean() })
const idParam = z.object({ id: z.string().uuid() })
const userFlatParam = z.object({ id: z.string().uuid(), flatId: z.string().uuid() })

const listFlatsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  block: z.string().optional(),
  search: z.string().optional(),
})
const exportCsvQuery = z.object({ block: z.string().optional() })
const createFlatBody = z.object({
  block: z.string().min(1),
  floor: z.string().min(1),
  unitNumber: z.string().min(1),
})
const updateFlatBody = z.object({
  block: z.string().min(1).optional(),
  floor: z.string().min(1).optional(),
  unitNumber: z.string().min(1).optional(),
  isRegistrationOpen: z.boolean().optional(),
})
const auditLogsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

// ── Dashboard ───────────────────────────────────────────────────────────────

// GET /api/admin/stats
admin.get('/stats', async (c) => {
  return c.json(await adminService.getStats(getDb(c.env.DB)))
})

// ── Users ─────────────────────────────────────────────────────────────────

// GET /api/admin/users
admin.get('/users', zValidator('query', listUsersQuery), async (c) => {
  return c.json(await adminService.listUsers(getDb(c.env.DB), c.req.valid('query')))
})

// POST /api/admin/users
admin.post('/users', zValidator('json', createUserBody), async (c) => {
  const result = await adminService.createUser(getDb(c.env.DB), c.get('user')!.id, c.req.valid('json'))
  return c.json(result, 201)
})

// PATCH /api/admin/users/:id/role
admin.patch('/users/:id/role', zValidator('param', idParam), zValidator('json', roleBody), async (c) => {
  const user = await adminService.updateUserRole(
    getDb(c.env.DB),
    c.get('user')!.id,
    c.req.valid('param').id,
    c.req.valid('json').role,
  )
  if (!user) return c.json({ error: 'User not found' }, 404)
  return c.json(user)
})

// PATCH /api/admin/users/:id/status
admin.patch('/users/:id/status', zValidator('param', idParam), zValidator('json', statusBody), async (c) => {
  const user = await adminService.updateUserStatus(
    getDb(c.env.DB),
    c.get('user')!.id,
    c.req.valid('param').id,
    c.req.valid('json').isActive,
  )
  if (!user) return c.json({ error: 'User not found' }, 404)
  return c.json(user)
})

// POST /api/admin/users/:id/reset-password
admin.post('/users/:id/reset-password', zValidator('param', idParam), async (c) => {
  const result = await adminService.resetUserPassword(
    getDb(c.env.DB),
    c.env,
    c.get('user')!.id,
    c.req.valid('param').id,
  )
  if (!result) return c.json({ error: 'User not found' }, 404)
  return c.json(result)
})

// DELETE /api/admin/users/:id
admin.delete('/users/:id', zValidator('param', idParam), async (c) => {
  const result = await adminService.deleteUser(getDb(c.env.DB), c.env, c.get('user')!.id, c.req.valid('param').id)
  switch (result.status) {
    case 'self':
      return c.json({ error: '不能刪除自己的帳戶' }, 400)
    case 'not_found':
      return c.json({ error: 'User not found' }, 404)
    case 'last_admin':
      return c.json({ error: '不能刪除最後一位系統管理員' }, 400)
    default:
      return c.body(null, 204)
  }
})

// GET /api/admin/users/:id/flats
admin.get('/users/:id/flats', zValidator('param', idParam), async (c) => {
  const flats = await adminService.listUserFlats(getDb(c.env.DB), c.req.valid('param').id)
  if (!flats) return c.json({ error: 'User not found' }, 404)
  return c.json({ data: flats })
})

// DELETE /api/admin/users/:id/flats/:flatId
admin.delete('/users/:id/flats/:flatId', zValidator('param', userFlatParam), async (c) => {
  const { id, flatId } = c.req.valid('param')
  await adminService.unlinkUserFlat(getDb(c.env.DB), c.get('user')!.id, id, flatId)
  return c.body(null, 204)
})

// ── Flats ─────────────────────────────────────────────────────────────────

// GET /api/admin/flats/blocks
admin.get('/flats/blocks', async (c) => {
  return c.json(await adminService.listBlocks(getDb(c.env.DB)))
})

// GET /api/admin/flats/export-csv
admin.get('/flats/export-csv', zValidator('query', exportCsvQuery), async (c) => {
  const csv = await adminService.exportFlatsCsv(getDb(c.env.DB), c.req.valid('query').block)
  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="flats-${new Date().toISOString().slice(0, 10)}.csv"`,
  })
})

// GET /api/admin/flats
admin.get('/flats', zValidator('query', listFlatsQuery), async (c) => {
  return c.json(await adminService.listFlats(getDb(c.env.DB), c.req.valid('query')))
})

// POST /api/admin/flats
admin.post('/flats', zValidator('json', createFlatBody), async (c) => {
  const flat = await adminService.createFlat(getDb(c.env.DB), c.get('user')!.id, c.req.valid('json'))
  return c.json(flat, 201)
})

// PATCH /api/admin/flats/:id
admin.patch('/flats/:id', zValidator('param', idParam), zValidator('json', updateFlatBody), async (c) => {
  const flat = await adminService.updateFlat(
    getDb(c.env.DB),
    c.get('user')!.id,
    c.req.valid('param').id,
    c.req.valid('json'),
  )
  if (!flat) return c.json({ error: 'Flat not found' }, 404)
  return c.json(flat)
})

// DELETE /api/admin/flats/:id
admin.delete('/flats/:id', zValidator('param', idParam), async (c) => {
  const result = await adminService.deleteFlat(getDb(c.env.DB), c.get('user')!.id, c.req.valid('param').id)
  switch (result.status) {
    case 'not_found':
      return c.json({ error: 'Flat not found' }, 404)
    case 'has_residents':
      return c.json({ error: '無法刪除此單位，尚有已註冊住戶', residentCount: result.residentCount }, 400)
    default:
      return c.json({ message: '單位已刪除' })
  }
})

// POST /api/admin/flats/:id/reset-password
admin.post('/flats/:id/reset-password', zValidator('param', idParam), async (c) => {
  const result = await adminService.resetFlatPassword(getDb(c.env.DB), c.get('user')!.id, c.req.valid('param').id)
  if (!result) return c.json({ error: 'Flat not found' }, 404)
  return c.json(result)
})

// ── Audit logs ──────────────────────────────────────────────────────────────

// GET /api/admin/audit-logs
admin.get('/audit-logs', zValidator('query', auditLogsQuery), async (c) => {
  return c.json(await adminService.listAuditLogs(getDb(c.env.DB), c.req.valid('query')))
})

export default admin
