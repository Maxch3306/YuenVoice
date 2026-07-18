import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppBindings } from '../../env.js'
import { getDb } from '../../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import * as ocDocumentService from '../services/oc-documents.js'

const DOC_TYPES = [
  'meeting_minutes',
  'financial_statement',
  'resolution',
  'notice',
  'meeting_livestream',
  'meeting_recording',
] as const

const LINK_TYPES = ['google_meet', 'google_drive', 'google_site'] as const

// Roles permitted to publish documents / links.
// mgmt_staff is included so management can post livestream / recording links.
const publisherRoles = ['oc_committee', 'mgmt_staff', 'admin'] as const

const listQuery = z.object({
  year: z.coerce.number().int().optional(),
  type: z.enum(DOC_TYPES).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
})

const linkBody = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.enum(DOC_TYPES),
  year: z.number().int().min(1900).max(2100),
  externalUrl: z.string().url().max(1024),
  linkType: z.enum(LINK_TYPES).optional(),
})

const ocDocuments = new Hono<AppBindings>()
ocDocuments.use('*', requireAuth())

// POST /api/oc-documents — upload file-backed document (multipart)
ocDocuments.post('/', requireRole(...publisherRoles), async (c) => {
  const db = getDb(c.env.DB)
  const form = await c.req.formData()

  let file: ArrayBuffer | null = null
  for (const [, value] of form.entries()) {
    if (value instanceof File) {
      file = await value.arrayBuffer()
      break
    }
  }
  if (!file) return c.json({ error: 'File is required' }, 400)

  const title = String(form.get('title') ?? '')
  const type = String(form.get('type') ?? '') as (typeof DOC_TYPES)[number]
  const year = Number(form.get('year'))
  const description = (form.get('description') as string) || undefined

  if (!title || !type || !year) {
    return c.json({ error: 'title, type, and year are required' }, 400)
  }
  if (!DOC_TYPES.includes(type)) {
    return c.json({ error: `type must be one of: ${DOC_TYPES.join(', ')}` }, 400)
  }
  if (isNaN(year) || year < 1900 || year > 2100) {
    return c.json({ error: 'year must be a valid year' }, 400)
  }

  const doc = await ocDocumentService.uploadDocument(
    db,
    c.env,
    c.get('user')!.id,
    { title, description, type, year },
    file,
  )
  return c.json(doc, 201)
})

// POST /api/oc-documents/link — publish a link-backed document (JSON)
ocDocuments.post('/link', requireRole(...publisherRoles), zValidator('json', linkBody), async (c) => {
  const db = getDb(c.env.DB)
  const doc = await ocDocumentService.publishLink(db, c.get('user')!.id, c.req.valid('json'))
  return c.json(doc, 201)
})

// GET /api/oc-documents — list documents (all authenticated users)
ocDocuments.get('/', zValidator('query', listQuery), async (c) => {
  const db = getDb(c.env.DB)
  return c.json(await ocDocumentService.listDocuments(db, c.req.valid('query')))
})

// GET /api/oc-documents/:id — document detail
ocDocuments.get('/:id', async (c) => {
  const db = getDb(c.env.DB)
  const doc = await ocDocumentService.getDocumentById(db, c.req.param('id'))
  if (!doc) return c.json({ error: 'Document not found' }, 404)
  return c.json(doc)
})

// DELETE /api/oc-documents/:id — remove document (publishers only)
ocDocuments.delete('/:id', requireRole(...publisherRoles), async (c) => {
  const db = getDb(c.env.DB)
  await ocDocumentService.removeDocument(db, c.env, c.req.param('id'), c.get('user')!.id)
  return c.json({ message: 'Document deleted' })
})

export default ocDocuments
