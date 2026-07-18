import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { AppBindings } from '../env.js'
import { HttpError } from './errors.js'
import authRoutes from './routes/auth.js'
import reportRoutes from './routes/reports.js'
import discussionRoutes from './routes/discussions.js'
import ocDocumentRoutes from './routes/oc-documents.js'
import notificationRoutes, { push as pushRoutes } from './routes/notifications.js'
import userFlatRoutes from './routes/user-flats.js'
import adminRoutes from './routes/admin.js'
import flatRoutes from './routes/flats.js'
import uploadRoutes from './routes/uploads.js'

// Builds the Hono application. The Worker serves the SPA via static assets and
// only receives /api/* and /uploads/* (see run_worker_first in wrangler.jsonc),
// so this app owns the API surface. Route groups are mounted in Phase 4.
export function createApp() {
  const app = new Hono<AppBindings>()

  // Security headers (replaces @fastify/helmet). CSP is left to the asset layer.
  app.use('*', secureHeaders())

  // CORS only when the client is served from a different origin (CLIENT_ORIGIN).
  // In the default single-Worker deployment the SPA is same-origin, so no CORS
  // headers are emitted and the httpOnly refresh cookie flows unchanged.
  app.use('/api/*', async (c, next) => {
    const origin = c.env.CLIENT_ORIGIN
    if (origin) return cors({ origin, credentials: true })(c, next)
    return next()
  })

  app.get('/api/health', (c) => c.json({ status: 'ok', runtime: 'workers' }))

  app.route('/api/auth', authRoutes)
  app.route('/api/reports', reportRoutes)
  app.route('/api/oc-documents', ocDocumentRoutes)
  app.route('/api/notifications', notificationRoutes)
  app.route('/api/push', pushRoutes)
  app.route('/api/users', userFlatRoutes)
  app.route('/api/admin', adminRoutes)
  app.route('/api/flats', flatRoutes)
  // Discussions declares /boards and /posts, so it mounts at /api (matching the
  // client's /api/boards and /api/posts). Registered LAST: its internal
  // `use('*', requireAuth())` would otherwise gate sibling /api routes (e.g. the
  // public /api/flats/*) mounted after it — order makes those respond first.
  app.route('/api', discussionRoutes)

  // Serve uploaded files from R2 (outside /api).
  app.route('/uploads', uploadRoutes)

  app.notFound((c) => c.json({ error: 'Not found' }, 404))
  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.statusCode as 400)
    }
    console.error('Unhandled error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  })

  return app
}
