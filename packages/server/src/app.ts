import path from 'node:path'
import { fn, col, literal } from 'sequelize'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { config } from './config/index.js'
import { Flat } from './models/index.js'
import redisPlugin from './plugins/redis.js'
import authPlugin from './plugins/auth.js'
import rbacPlugin from './plugins/rbac.js'
import uploadPlugin from './plugins/upload.js'
import authRoutes from './routes/auth.js'
import reportRoutes from './routes/reports.js'
import discussionRoutes from './routes/discussions.js'
import ocDocumentRoutes from './routes/oc-documents.js'
import notificationRoutes from './routes/notifications.js'
import adminRoutes from './routes/admin.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
    },
  })

  // 1. CORS
  await app.register(cors, {
    origin: config.nodeEnv === 'production' ? false : true,
    credentials: true,
  })

  // 2. Helmet (security headers)
  await app.register(helmet, {
    contentSecurityPolicy: config.nodeEnv === 'production' ? undefined : false,
  })

  // 3. Rate limiting (global default: 100 req/min)
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  // 4. Redis client
  await app.register(redisPlugin)

  // 5. Auth (registers @fastify/cookie + @fastify/jwt + authenticate decorator)
  await app.register(authPlugin)

  // 6. RBAC
  await app.register(rbacPlugin)

  // 7. Upload (registers @fastify/multipart)
  await app.register(uploadPlugin)

  // 8. Static file serving for uploads
  const uploadsDir = path.resolve(config.uploadDir)
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  })

  // ── Routes ──

  // 9. Auth routes
  await app.register(authRoutes, { prefix: `${config.apiPrefix}/auth` })

  // 10. Report routes
  await app.register(reportRoutes, { prefix: `${config.apiPrefix}/reports` })

  // 11. Discussion routes (boards + posts)
  await app.register(discussionRoutes)

  // 12. OC Document routes
  await app.register(ocDocumentRoutes)

  // 13. Notification + Push routes
  await app.register(notificationRoutes)

  // 14. Admin routes
  await app.register(adminRoutes)

  // ── Flat lookup endpoints (public — used by register + reports) ──

  app.get(`${config.apiPrefix}/flats/blocks`, async () => {
    const rows = await Flat.findAll({
      attributes: [[fn('DISTINCT', col('block')), 'block']],
      order: [['block', 'ASC']],
      raw: true,
    })
    return rows.map((r: any) => r.block)
  })

  app.get(`${config.apiPrefix}/flats/floors`, async () => {
    const rows = await Flat.findAll({
      attributes: [[fn('DISTINCT', col('floor')), 'floor']],
      raw: true,
    })
    return rows.map((r: any) => r.floor).sort((a: string, b: string) => Number(a) - Number(b))
  })

  app.get(
    `${config.apiPrefix}/flats/units`,
    {
      schema: {
        querystring: {
          type: 'object' as const,
          properties: {
            block: { type: 'string' as const },
            floor: { type: 'string' as const },
          },
        },
      },
    },
    async (request) => {
      const { block, floor } = request.query as { block?: string; floor?: string }
      const where: Record<string, string> = {}
      if (block) where.block = block
      if (floor) where.floor = floor
      const rows = await Flat.findAll({
        attributes: [[fn('DISTINCT', col('unit_number')), 'unit_number']],
        where,
        order: [['unit_number', 'ASC']],
        raw: true,
      })
      return rows.map((r: any) => r.unit_number)
    }
  )

  // Health check
  app.get(`${config.apiPrefix}/health`, async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // 404 handler for unmatched API routes
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({ error: 'Not Found', statusCode: 404 })
  })

  return app
}
