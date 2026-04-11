import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    rbac: (allowedRoles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(
  async function rbacPlugin(fastify: FastifyInstance) {
    fastify.decorate(
      'rbac',
      function (allowedRoles: string[]) {
        return async function (request: FastifyRequest, reply: FastifyReply) {
          const user = request.user
          if (!user || !allowedRoles.includes(user.role)) {
            reply.status(403).send({ error: 'Forbidden' })
          }
        }
      }
    )
  },
  {
    name: 'rbac-plugin',
    dependencies: ['auth-plugin'],
  }
)
