import type { FastifyInstance } from 'fastify'
import * as userFlatService from '../services/user-flat.service.js'

export default async function userFlatRoutes(fastify: FastifyInstance) {
  // Every route under /api/users/me/flats requires a valid JWT.
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/users/me/flats — list every flat owned by the user
  fastify.get('/api/users/me/flats', async (request) => {
    const flats = await userFlatService.listUserFlats(request.user.id)
    return { data: flats }
  })

  // POST /api/users/me/flats — claim an additional unit by registration password
  fastify.post(
    '/api/users/me/flats',
    {
      schema: {
        body: {
          type: 'object',
          required: ['block', 'floor', 'unitNumber', 'flatPassword'],
          properties: {
            block: { type: 'string', minLength: 1 },
            floor: { type: 'string', minLength: 1 },
            unitNumber: { type: 'string', minLength: 1 },
            flatPassword: { type: 'string', minLength: 1 },
          },
          additionalProperties: false,
        },
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const body = request.body as {
        block: string
        floor: string
        unitNumber: string
        flatPassword: string
      }
      const result = await userFlatService.linkFlat(request.user.id, body)
      return reply.status(201).send(result)
    },
  )

  // DELETE /api/users/me/flats/:flatId — unlink an additional unit
  fastify.delete(
    '/api/users/me/flats/:flatId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['flatId'],
          properties: {
            flatId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { flatId } = request.params as { flatId: string }
      await userFlatService.unlinkFlat(request.user.id, flatId)
      return reply.status(204).send()
    },
  )
}
