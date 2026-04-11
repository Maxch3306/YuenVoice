import fp from 'fastify-plugin'
import fjwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { config } from '../config/index.js'

export interface UserPayload {
  id: string
  email: string
  role: string
  flatId: string | null
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UserPayload
    user: UserPayload
  }
}

export default fp(
  async function authPlugin(fastify: FastifyInstance) {
    // Register cookie plugin for refresh tokens
    await fastify.register(cookie, {
      secret: config.jwtRefreshSecret,
      parseOptions: {},
    })

    // Register JWT plugin
    await fastify.register(fjwt, {
      secret: config.jwtAccessSecret,
      sign: {
        expiresIn: '15m',
      },
    })

    // Decorate authenticate preHandler
    fastify.decorate(
      'authenticate',
      async function (request: FastifyRequest, reply: FastifyReply) {
        try {
          await request.jwtVerify()
        } catch (err) {
          reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
        }
      }
    )
  },
  {
    name: 'auth-plugin',
    dependencies: [],
  }
)
