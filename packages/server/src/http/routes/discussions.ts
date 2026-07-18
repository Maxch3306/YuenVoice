import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppBindings } from '../../env.js'
import { getDb } from '../../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { parsePagination, paginatedResponse } from '../../utils/pagination.js'
import * as discussionService from '../services/discussions.js'

// oc_committee is review-only on posts: read everything, react, and flag, but
// cannot author posts or comments. mgmt/admin/resident retain write access.
const writerRoles = ['resident', 'mgmt_staff', 'admin'] as const
const mgmtRoles = ['mgmt_staff', 'admin'] as const

// ── Validation schemas ──
const idParam = z.object({ id: z.string().uuid() })
const paginationQuery = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
})
const commentBody = z.object({
  content: z.string().min(1).max(2000),
  isAnonymous: z.boolean().optional(),
})
const reactionBody = z.object({ type: z.enum(['like']) })
const reportBody = z.object({ reason: z.string().max(500).optional() })
const moderateBody = z.object({ action: z.enum(['hide', 'pin', 'unpin', 'delete']) })

const discussions = new Hono<AppBindings>()
discussions.use('*', requireAuth())

// GET /boards — list boards accessible to the user
discussions.get('/boards', async (c) => {
  const db = getDb(c.env.DB)
  const user = c.get('user')!
  const boards = await discussionService.listBoards(db, user.id, user.role)
  return c.json({ data: boards })
})

// GET /boards/:id/posts — list posts in a board (paginated)
discussions.get(
  '/boards/:id/posts',
  zValidator('param', idParam),
  zValidator('query', paginationQuery),
  async (c) => {
    const db = getDb(c.env.DB)
    const boardId = c.req.valid('param').id
    const query = c.req.valid('query')
    const pagination = parsePagination(query)
    const page = Number(query.page) || 1

    const { count, rows } = await discussionService.listPosts(
      db,
      boardId,
      pagination,
      c.get('user')!.role,
    )

    return c.json(paginatedResponse(rows, count, page, pagination.limit))
  },
)

// POST /boards/:id/posts — create post (multipart). oc_committee is review-only
// and cannot author posts; they keep read access via GET routes.
discussions.post(
  '/boards/:id/posts',
  requireRole(...writerRoles),
  zValidator('param', idParam),
  async (c) => {
    const db = getDb(c.env.DB)
    const boardId = c.req.valid('param').id
    const form = await c.req.formData()

    const title = String(form.get('title') ?? '')
    const body = String(form.get('body') ?? '')

    if (!title || title.length > 200) {
      return c.json(
        { error: 'Bad Request', message: 'title is required and must be at most 200 characters' },
        400,
      )
    }
    if (!body || body.length > 10000) {
      return c.json(
        { error: 'Bad Request', message: 'body is required and must be at most 10000 characters' },
        400,
      )
    }

    const isAnonymous = form.get('isAnonymous') === 'true'

    const files: ArrayBuffer[] = []
    for (const [, value] of form.entries()) {
      if (value instanceof File) files.push(await value.arrayBuffer())
    }

    const post = await discussionService.createPost(
      db,
      c.env,
      boardId,
      c.get('user')!.id,
      { title, body, isAnonymous },
      files,
    )

    return c.json({ data: post }, 201)
  },
)

// GET /posts/:id — post detail
discussions.get('/posts/:id', zValidator('param', idParam), async (c) => {
  const db = getDb(c.env.DB)
  const post = await discussionService.getPost(db, c.req.valid('param').id, c.get('user')!.role)
  if (!post) return c.json({ error: 'Not Found', message: 'Post not found' }, 404)
  return c.json({ data: post })
})

// POST /posts/:id/comments — add comment. Committee is review-only.
discussions.post(
  '/posts/:id/comments',
  requireRole(...writerRoles),
  zValidator('param', idParam),
  zValidator('json', commentBody),
  async (c) => {
    const db = getDb(c.env.DB)
    const { content, isAnonymous } = c.req.valid('json')
    const comment = await discussionService.addComment(
      db,
      c.req.valid('param').id,
      c.get('user')!.id,
      content,
      isAnonymous ?? false,
    )
    if (!comment) return c.json({ error: 'Not Found', message: 'Post not found' }, 404)
    return c.json({ data: comment }, 201)
  },
)

// POST /posts/:id/reactions — toggle reaction (any authed user, incl. committee)
discussions.post(
  '/posts/:id/reactions',
  zValidator('param', idParam),
  zValidator('json', reactionBody),
  async (c) => {
    const db = getDb(c.env.DB)
    const result = await discussionService.toggleReaction(
      db,
      c.req.valid('param').id,
      c.get('user')!.id,
      c.req.valid('json').type,
    )
    if (!result) return c.json({ error: 'Not Found', message: 'Post not found' }, 404)
    return c.json({ data: result })
  },
)

// POST /posts/:id/report — flag post (any authed user, incl. committee)
discussions.post(
  '/posts/:id/report',
  zValidator('param', idParam),
  zValidator('json', reportBody),
  async (c) => {
    const db = getDb(c.env.DB)
    const result = await discussionService.flagPost(
      db,
      c.req.valid('param').id,
      c.get('user')!.id,
      c.req.valid('json').reason,
    )
    if (!result) return c.json({ error: 'Not Found', message: 'Post not found' }, 404)
    return c.json(result)
  },
)

// PATCH /posts/:id/moderate — moderation actions (mgmt/admin only)
discussions.patch(
  '/posts/:id/moderate',
  requireRole(...mgmtRoles),
  zValidator('param', idParam),
  zValidator('json', moderateBody),
  async (c) => {
    const db = getDb(c.env.DB)
    const result = await discussionService.moderatePost(
      db,
      c.req.valid('param').id,
      c.req.valid('json').action,
      c.get('user')!.id,
    )
    if (!result) return c.json({ error: 'Not Found', message: 'Post not found' }, 404)
    return c.json({ data: result })
  },
)

export default discussions
