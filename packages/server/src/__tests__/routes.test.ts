import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { getTestApp, closeTestApp, generateTestToken, injectWithToken } from './helpers/setup.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await getTestApp()
})

afterAll(async () => {
  await closeTestApp()
})

// ── Health Check ──

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
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

describe('GET /api/nonexistent', () => {
  it('returns 404 with structured JSON', async () => {
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

// ── Protected Routes: No Auth → 401 ──

describe('Protected routes without auth return 401', () => {
  it('GET /api/reports → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/reports' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/reports → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/reports',
      payload: { title: 'Test', type: 'repair', description: 'Test' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/boards → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/boards' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/notifications → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/notifications' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/oc-documents → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/oc-documents' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/users → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/users' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/stats → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/stats' })
    expect(res.statusCode).toBe(401)
  })
})

// ── RBAC: Non-admin token on admin routes → 403 ──

describe('Admin routes with non-admin token return 403', () => {
  let residentToken: string

  beforeAll(async () => {
    residentToken = await generateTestToken(app, {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'resident@test.com',
      role: 'resident',
      flatId: '00000000-0000-0000-0000-000000000099',
    })
  })

  it('GET /api/admin/users with resident token → 403', async () => {
    const inject = injectWithToken(app, residentToken)
    const res = await inject({ method: 'GET', url: '/api/admin/users' })
    expect(res.statusCode).toBe(403)
  })

  it('GET /api/admin/stats with resident token → 403', async () => {
    const inject = injectWithToken(app, residentToken)
    const res = await inject({ method: 'GET', url: '/api/admin/stats' })
    expect(res.statusCode).toBe(403)
  })
})

// ── RBAC: Non-mgmt token on notification send → 403 ──

describe('Management-only routes with resident token return 403', () => {
  let residentToken: string

  beforeAll(async () => {
    residentToken = await generateTestToken(app, {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'resident@test.com',
      role: 'resident',
      flatId: '00000000-0000-0000-0000-000000000099',
    })
  })

  it('POST /api/notifications with resident token → 403', async () => {
    const inject = injectWithToken(app, residentToken)
    const res = await inject({
      method: 'POST',
      url: '/api/notifications',
      payload: {
        title: 'Test',
        body: 'Test notification',
        category: 'general',
        targetType: 'all',
      },
    })
    expect(res.statusCode).toBe(403)
  })
})

// ── Invalid auth header ──

describe('Invalid auth headers', () => {
  it('GET /api/reports with malformed Bearer token → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports',
      headers: { authorization: 'Bearer invalid.jwt.token' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/reports with no Bearer prefix → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports',
      headers: { authorization: 'some-random-string' },
    })
    expect(res.statusCode).toBe(401)
  })
})
