import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../../env.js'
import { verifyToken } from '../jwt.js'

// Verify the Bearer access token and populate c.var.user. Replaces the Fastify
// `authenticate` decorator.
export function requireAuth(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const header = c.req.header('Authorization')
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401)
    }
    try {
      const p = await verifyToken(header.slice(7), c.env.JWT_ACCESS_SECRET)
      c.set('user', { id: p.id, email: p.email, role: p.role, flat_id: p.flatId ?? null })
    } catch {
      return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401)
    }
    await next()
  }
}

// Optional auth: populate c.var.user if a valid token is present, else continue
// unauthenticated. Used by endpoints with mixed public/authed behavior.
export function optionalAuth(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const header = c.req.header('Authorization')
    if (header?.startsWith('Bearer ')) {
      try {
        const p = await verifyToken(header.slice(7), c.env.JWT_ACCESS_SECRET)
        c.set('user', { id: p.id, email: p.email, role: p.role, flat_id: p.flatId ?? null })
      } catch {
        // ignore invalid token — treat as anonymous
      }
    }
    await next()
  }
}
