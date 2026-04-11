import fp from 'fastify-plugin'
import Redis from 'ioredis'
import type { FastifyInstance } from 'fastify'
import { config } from '../config/index.js'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

export default fp(
  async function redisPlugin(fastify: FastifyInstance) {
    const redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })

    redis.on('error', (err) => {
      fastify.log.warn({ err }, 'Redis connection error — continuing without Redis')
    })

    redis.on('connect', () => {
      fastify.log.info('Redis connected')
    })

    try {
      await redis.connect()
    } catch (err) {
      fastify.log.warn({ err }, 'Redis initial connection failed — continuing without Redis')
    }

    fastify.decorate('redis', redis)

    fastify.addHook('onClose', async () => {
      await redis.quit()
    })
  },
  {
    name: 'redis-plugin',
    dependencies: [],
  }
)
