import { Hono } from 'hono'
import type { AppBindings } from '../../env.js'

// Serve uploaded files from R2 (replaces @fastify/static serving local disk).
// Object keys are uuid-named and immutable, so they cache aggressively.
const uploads = new Hono<AppBindings>()

uploads.get('/*', async (c) => {
  const key = c.req.path.replace(/^\/uploads\//, '')
  if (!key) return c.json({ error: 'Not found' }, 404)

  const obj = await c.env.UPLOADS.get(key)
  if (!obj) return c.json({ error: 'Not found' }, 404)

  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(obj.body, { headers })
})

export default uploads
