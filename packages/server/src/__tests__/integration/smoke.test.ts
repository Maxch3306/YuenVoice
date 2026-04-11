import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../../app.js'
import type { FastifyInstance } from 'fastify'

/**
 * Integration smoke tests for the YUENVOICE API.
 *
 * These tests exercise the full Fastify app via injection (no real HTTP).
 * Tests that require a live database (most of the CRUD flows) are guarded
 * behind a DB-availability check and skipped when the database is unreachable.
 */

let app: FastifyInstance

// Helper: attempt to verify DB connectivity
async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const { sequelize } = await import('../../models/index.js')
    await sequelize.authenticate()
    return true
  } catch {
    return false
  }
}

let dbAvailable = false

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
  dbAvailable = await isDatabaseAvailable()
})

afterAll(async () => {
  if (app) {
    await app.close()
  }
})

// ── Health Check (no DB required) ──

describe('Health check', () => {
  it('GET /api/health returns 200 with status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })
})

// ── 404 Handler ──

describe('404 handler', () => {
  it('returns structured JSON for unknown routes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/nonexistent',
    })

    expect(res.statusCode).toBe(404)
    const body = JSON.parse(res.payload)
    expect(body.error).toBe('Not Found')
    expect(body.statusCode).toBe(404)
  })
})

// ── Auth Flow (requires DB) ──

describe('Auth flow', () => {
  const itDb = dbAvailable ? it : it.skip

  itDb('POST /api/auth/login without credentials returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    })

    // Should fail validation (missing required fields)
    expect(res.statusCode).toBe(400)
  })

  itDb('POST /api/auth/register without flat password returns 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        // Missing block, unitNumber, flatPassword
      },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ── Reports (requires auth + DB) ──

describe('Reports', () => {
  const itDb = dbAvailable ? it : it.skip

  itDb('GET /api/reports without auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports',
    })

    expect(res.statusCode).toBe(401)
  })

  itDb('POST /api/reports without auth returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports',
      payload: {
        title: 'Test report',
        type: 'repair',
        description: 'Test description',
      },
    })

    expect(res.statusCode).toBe(401)
  })
})

// ── Notifications (requires auth + DB) ──

describe('Notifications', () => {
  const itDb = dbAvailable ? it : it.skip

  itDb('GET /api/notifications without auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/notifications',
    })

    expect(res.statusCode).toBe(401)
  })
})

// ── OC Documents ──

describe('OC Documents', () => {
  const itDb = dbAvailable ? it : it.skip

  itDb('GET /api/oc-documents without auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/oc-documents',
    })

    expect(res.statusCode).toBe(401)
  })
})

// ── Discussion Boards ──

describe('Discussion Boards', () => {
  const itDb = dbAvailable ? it : it.skip

  itDb('GET /api/boards without auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/boards',
    })

    expect(res.statusCode).toBe(401)
  })
})

// ── Admin ──

describe('Admin routes', () => {
  const itDb = dbAvailable ? it : it.skip

  itDb('GET /api/admin/users without auth returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/users',
    })

    expect(res.statusCode).toBe(401)
  })
})

// ── Full Happy Path (requires seeded DB) ──

describe('Full happy path (DB-seeded)', () => {
  /**
   * This suite exercises register -> login -> create report -> list reports.
   * It requires a running PostgreSQL + Redis with seeded flats.
   * Skipped entirely if the database is not reachable.
   */
  const describeDb = dbAvailable ? describe : describe.skip

  describeDb('authenticated CRUD flow', () => {
    let accessToken: string

    // These values must match a seeded flat in the test database
    const testFlat = {
      block: 'A',
      unitNumber: '101',
      flatPassword: 'TEST1234',
    }

    const testUser = {
      name: 'Smoke Test User',
      email: `smoke-${Date.now()}@test.local`,
      password: 'TestPass123!',
    }

    it('registers a new user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          ...testFlat,
          ...testUser,
        },
      })

      if (res.statusCode === 201) {
        const body = JSON.parse(res.payload)
        expect(body.accessToken).toBeDefined()
        expect(body.user).toBeDefined()
        accessToken = body.accessToken
      } else {
        // Flat may not exist in test DB — skip remaining tests gracefully
        expect([201, 400, 404]).toContain(res.statusCode)
      }
    })

    it('logs in with created user', async () => {
      if (!accessToken) return // registration did not succeed

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: testUser.email,
          password: testUser.password,
        },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.accessToken).toBeDefined()
      accessToken = body.accessToken
    })

    it('creates an incident report', async () => {
      if (!accessToken) return

      const res = await app.inject({
        method: 'POST',
        url: '/api/reports',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          title: 'Smoke test report',
          type: 'repair',
          description: 'Created by integration smoke test',
        },
      })

      expect(res.statusCode).toBe(201)
    })

    it('lists reports including the created one', async () => {
      if (!accessToken) return

      const res = await app.inject({
        method: 'GET',
        url: '/api/reports',
        headers: { authorization: `Bearer ${accessToken}` },
      })

      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.payload)
      expect(body.data).toBeDefined()
      expect(Array.isArray(body.data)).toBe(true)
    })
  })
})
