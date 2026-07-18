import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import type { AppBindings } from '../env.js'

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

  // Route groups mounted here in Phase 4:
  //   app.route('/api/auth', authRoutes)
  //   app.route('/api/reports', reportRoutes)
  //   ...

  app.notFound((c) => c.json({ error: 'Not found' }, 404))
  app.onError((err, c) => {
    console.error('Unhandled error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  })

  return app
}
