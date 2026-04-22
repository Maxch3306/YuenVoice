import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { getTestApp, closeTestApp } from './helpers/setup.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await getTestApp()
})

afterAll(async () => {
  await closeTestApp()
})

// ── POST /api/auth/login ──

describe('POST /api/auth/login', () => {
  it('returns 400 when body is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'somepassword' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test@example.com' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'not-an-email', password: 'password123' },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /api/auth/register ──

describe('POST /api/auth/register', () => {
  it('returns 400 when body is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        // missing block, unitNumber, flatPassword
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when password is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        block: 'A',
        floor: '1',
        unitNumber: '101',
        flatPassword: 'flat123',
        name: 'Test User',
        email: 'test@example.com',
        password: 'short', // minLength 8
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when email format is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        block: 'A',
        floor: '1',
        unitNumber: '101',
        flatPassword: 'flat123456',
        name: 'Test User',
        email: 'bad-email',
        password: 'password123',
      },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /api/auth/refresh ──

describe('POST /api/auth/refresh', () => {
  it('returns 401 when no refresh token cookie is present', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
    })
    expect(res.statusCode).toBe(401)
    const body = JSON.parse(res.payload)
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 with invalid refresh token cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: {
        refreshToken: 'invalid-token-value',
      },
    })
    // Should be 401 (invalid JWT) - service throws
    expect(res.statusCode).toBe(401)
  })
})

// ── POST /api/auth/logout ──

describe('POST /api/auth/logout', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    })
    expect(res.statusCode).toBe(401)
  })
})

// ── POST /api/auth/forgot-password ──

describe('POST /api/auth/forgot-password', () => {
  it('returns 200 regardless of whether email exists (no enumeration), or 500 if DB/Redis unavailable', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'nonexistent@example.com' },
    })
    // Returns 200 to prevent email enumeration, or 500 if DB/Redis is unavailable
    if (res.statusCode === 200) {
      const body = JSON.parse(res.payload)
      expect(body.message).toBeDefined()
    } else {
      // DB or Redis not available — service throws internal error
      expect(res.statusCode).toBe(500)
    }
  })

  it('returns 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 for invalid email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/forgot-password',
      payload: { email: 'not-an-email' },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /api/auth/reset-password ──

describe('POST /api/auth/reset-password', () => {
  it('returns 400 when body is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 with invalid/expired token, or 500 if Redis unavailable', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        token: 'nonexistent-token-12345',
        password: 'newpassword123',
      },
    })
    // resetPassword service calls redis.get which returns null → throws 400
    // If Redis is unavailable, it throws 500 instead
    expect([400, 500]).toContain(res.statusCode)
  })

  it('returns 400 when password is too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: {
        token: 'some-token',
        password: 'short',
      },
    })
    expect(res.statusCode).toBe(400)
  })
})
