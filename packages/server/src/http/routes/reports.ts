import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppBindings } from '../../env.js'
import { getDb } from '../../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import * as reportService from '../services/reports.js'

// oc_committee is review-only on reports: read everything, write nothing.
// mgmt/admin have full write access; residents file + follow up their own.
const writerRoles = ['resident', 'mgmt_staff', 'admin'] as const
const mgmtRoles = ['mgmt_staff', 'admin'] as const

const listQuery = z.object({
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  type: z.enum(['repair', 'complaint', 'inquiry']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})
const commentBody = z.object({
  content: z.string().min(1).max(5000),
  isInternal: z.boolean().optional(),
})
const statusBody = z.object({ status: z.enum(['pending', 'in_progress', 'completed']) })

// Collect File entries from a multipart form regardless of field name.
async function collectFiles(form: FormData): Promise<ArrayBuffer[]> {
  const files: ArrayBuffer[] = []
  for (const [, value] of form.entries()) {
    if (value instanceof File) files.push(await value.arrayBuffer())
  }
  return files
}

const reports = new Hono<AppBindings>()
reports.use('*', requireAuth())

// POST /api/reports — create (multipart: fields + optional attachments)
reports.post('/', requireRole(...writerRoles), async (c) => {
  const db = getDb(c.env.DB)
  const form = await c.req.formData()
  const title = String(form.get('title') ?? '')
  const type = String(form.get('type') ?? '')
  const description = String(form.get('description') ?? '')

  if (!title || title.length > 200)
    return c.json({ error: 'Bad Request', message: 'title is required (max 200 chars)' }, 400)
  if (!['repair', 'complaint', 'inquiry'].includes(type))
    return c.json({ error: 'Bad Request', message: 'type must be repair, complaint, or inquiry' }, 400)
  if (!description || description.length > 5000)
    return c.json({ error: 'Bad Request', message: 'description is required (max 5000 chars)' }, 400)

  const report = await reportService.create(db, c.get('user')!.id, {
    title,
    type: type as 'repair',
    description,
    locationBlock: (form.get('locationBlock') as string) || null,
    locationFloor: (form.get('locationFloor') as string) || null,
    locationArea: (form.get('locationArea') as string) || null,
  })

  const files = await collectFiles(form)
  if (files.length > 0) await reportService.addAttachments(db, c.env, report.id, files)

  return c.json(report, 201)
})

// GET /api/reports — list
reports.get('/', zValidator('query', listQuery), async (c) => {
  const db = getDb(c.env.DB)
  const user = c.get('user')!
  return c.json(await reportService.list(db, user.id, user.role, c.req.valid('query')))
})

// GET /api/reports/:id — detail
reports.get('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const user = c.get('user')!
  const result = await reportService.getById(db, c.req.param('id'), user.id, user.role)
  if (!result) return c.json({ error: 'Report not found' }, 404)
  if ('forbidden' in result) return c.json({ error: 'Forbidden' }, 403)
  return c.json(result)
})

// PATCH /api/reports/:id/status — mgmt/admin only
reports.patch('/:id/status', requireRole(...mgmtRoles), zValidator('json', statusBody), async (c) => {
  const db = getDb(c.env.DB)
  const report = await reportService.updateStatus(db, c.req.param('id'), c.req.valid('json').status, c.get('user')!.id)
  if (!report) return c.json({ error: 'Report not found' }, 404)
  return c.json(report)
})

// POST /api/reports/:id/comments — writers only (committee blocked)
reports.post('/:id/comments', requireRole(...writerRoles), zValidator('json', commentBody), async (c) => {
  const db = getDb(c.env.DB)
  const user = c.get('user')!
  const { content, isInternal } = c.req.valid('json')
  const comment = await reportService.addComment(db, c.env, c.req.param('id'), user.id, user.role, content, isInternal ?? false)
  if (!comment) return c.json({ error: 'Report not found' }, 404)
  return c.json(comment, 201)
})

// POST /api/reports/:id/attachments — writers only (committee blocked)
reports.post('/:id/attachments', requireRole(...writerRoles), async (c) => {
  const db = getDb(c.env.DB)
  const files = await collectFiles(await c.req.formData())
  if (files.length === 0) return c.json({ error: 'No files provided' }, 400)
  if (files.length > 5) return c.json({ error: 'Maximum 5 files allowed' }, 400)

  const attachments = await reportService.addAttachments(db, c.env, c.req.param('id'), files)
  if (!attachments) return c.json({ error: 'Report not found' }, 404)
  return c.json(attachments, 201)
})

export default reports
