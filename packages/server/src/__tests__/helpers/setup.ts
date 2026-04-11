import { beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../app.js'
import type { FastifyInstance } from 'fastify'

let _app: FastifyInstance | null = null

/**
 * Build and cache a Fastify app instance for testing.
 * The app is built once and reused across tests in the same suite.
 * Redis will attempt to connect but the app still starts if it fails.
 */
export async function getTestApp(): Promise<FastifyInstance> {
  if (!_app) {
    _app = await buildApp()
    await _app.ready()
  }
  return _app
}

/**
 * Close the cached test app. Call in afterAll().
 */
export async function closeTestApp(): Promise<void> {
  if (_app) {
    await _app.close()
    _app = null
  }
}

/**
 * Check if a real database connection is available.
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const { sequelize } = await import('../../models/index.js')
    await sequelize.authenticate()
    return true
  } catch {
    return false
  }
}

/**
 * Helper to create an inject wrapper that includes auth headers for a given JWT.
 * Usage:
 *   const inject = injectWithToken(app, token)
 *   const res = await inject({ method: 'GET', url: '/api/reports' })
 */
export function injectWithToken(
  app: FastifyInstance,
  token: string
) {
  return (opts: Parameters<FastifyInstance['inject']>[0]) => {
    const options = typeof opts === 'string' ? { url: opts } : { ...opts }
    return app.inject({
      ...options,
      headers: {
        ...((options as any).headers || {}),
        authorization: `Bearer ${token}`,
      },
    })
  }
}

/**
 * Generate a JWT token signed with the test app's JWT secret.
 * This requires the app to be ready (so @fastify/jwt is registered).
 */
export async function generateTestToken(
  app: FastifyInstance,
  payload: { id: string; email: string; role: string; flatId: string | null }
): Promise<string> {
  return app.jwt.sign(payload)
}
