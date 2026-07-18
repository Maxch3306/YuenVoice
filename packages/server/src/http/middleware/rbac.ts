import type { MiddlewareHandler } from 'hono'
import type { AppBindings } from '../../env.js'

type Role = 'resident' | 'oc_committee' | 'mgmt_staff' | 'admin'

// Role gate — chain after requireAuth(). Replaces the Fastify `rbac(roles)`
// decorator.
export function requireRole(...roles: Role[]): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const user = c.get('user')
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  }
}
