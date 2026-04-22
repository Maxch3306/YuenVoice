import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as authService from '../services/auth.service.js'

// ── JSON Schemas ──

const registerSchema = {
  body: {
    type: 'object' as const,
    required: ['block', 'floor', 'unitNumber', 'flatPassword', 'name', 'email', 'password'],
    properties: {
      block: { type: 'string' as const, minLength: 1 },
      floor: { type: 'string' as const, minLength: 1 },
      unitNumber: { type: 'string' as const, minLength: 1 },
      flatPassword: { type: 'string' as const, minLength: 1 },
      name: { type: 'string' as const, minLength: 1 },
      email: { type: 'string' as const, format: 'email' },
      phone: { type: 'string' as const },
      password: { type: 'string' as const, minLength: 8 },
    },
    additionalProperties: false,
  },
}

const verifyFlatPasswordSchema = {
  body: {
    type: 'object' as const,
    required: ['block', 'floor', 'unitNumber', 'flatPassword'],
    properties: {
      block: { type: 'string' as const, minLength: 1 },
      floor: { type: 'string' as const, minLength: 1 },
      unitNumber: { type: 'string' as const, minLength: 1 },
      flatPassword: { type: 'string' as const, minLength: 1 },
    },
    additionalProperties: false,
  },
}

const loginSchema = {
  body: {
    type: 'object' as const,
    required: ['email', 'password'],
    properties: {
      email: { type: 'string' as const, format: 'email' },
      password: { type: 'string' as const, minLength: 1 },
    },
    additionalProperties: false,
  },
}

const forgotPasswordSchema = {
  body: {
    type: 'object' as const,
    required: ['email'],
    properties: {
      email: { type: 'string' as const, format: 'email' },
    },
    additionalProperties: false,
  },
}

const resetPasswordSchema = {
  body: {
    type: 'object' as const,
    required: ['token', 'password'],
    properties: {
      token: { type: 'string' as const, minLength: 1 },
      password: { type: 'string' as const, minLength: 8 },
    },
    additionalProperties: false,
  },
}

// ── Cookie helper ──

const REFRESH_COOKIE_NAME = 'refreshToken'

function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  })
}

function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  })
}

// ── Rate limit config ──

const authRateLimit = { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }

// ── Route plugin ──

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /register
  fastify.post(
    '/register',
    { schema: registerSchema, ...authRateLimit },
    async (
      request: FastifyRequest<{
        Body: {
          block: string
          floor: string
          unitNumber: string
          flatPassword: string
          name: string
          email: string
          phone?: string
          password: string
        }
      }>,
      reply: FastifyReply
    ) => {
      const result = await authService.register(fastify, request.body)
      setRefreshCookie(reply, result.refreshToken)
      return reply.status(201).send({
        user: result.user,
        accessToken: result.accessToken,
      })
    }
  )

  // POST /verify-flat-password — step 2 of registration: confirm the flat password
  // before collecting personal details. Does not create any account.
  fastify.post(
    '/verify-flat-password',
    { schema: verifyFlatPasswordSchema, ...authRateLimit },
    async (
      request: FastifyRequest<{
        Body: {
          block: string
          floor: string
          unitNumber: string
          flatPassword: string
        }
      }>,
      reply: FastifyReply
    ) => {
      await authService.verifyFlatPassword(request.body)
      return reply.send({ ok: true })
    }
  )

  // POST /login
  fastify.post(
    '/login',
    { schema: loginSchema, ...authRateLimit },
    async (
      request: FastifyRequest<{
        Body: { email: string; password: string }
      }>,
      reply: FastifyReply
    ) => {
      const result = await authService.login(fastify, request.body)
      setRefreshCookie(reply, result.refreshToken)
      return reply.send({
        user: result.user,
        accessToken: result.accessToken,
      })
    }
  )

  // POST /refresh
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE_NAME]
    if (!refreshToken) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'No refresh token provided' })
    }

    const result = await authService.refresh(fastify, refreshToken)
    setRefreshCookie(reply, result.refreshToken)
    return reply.send({ user: result.user, accessToken: result.accessToken })
  })

  // POST /logout
  fastify.post(
    '/logout',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const refreshToken = request.cookies[REFRESH_COOKIE_NAME]
      await authService.logout(fastify, request.user.id, refreshToken)
      clearRefreshCookie(reply)
      return reply.send({ message: 'Logged out' })
    }
  )

  // POST /forgot-password
  fastify.post(
    '/forgot-password',
    { schema: forgotPasswordSchema, ...authRateLimit },
    async (
      request: FastifyRequest<{ Body: { email: string } }>,
      reply: FastifyReply
    ) => {
      await authService.forgotPassword(fastify, request.body.email)
      return reply.send({ message: 'If that email exists, a reset link has been sent' })
    }
  )

  // POST /reset-password
  fastify.post(
    '/reset-password',
    { schema: resetPasswordSchema, ...authRateLimit },
    async (
      request: FastifyRequest<{ Body: { token: string; password: string } }>,
      reply: FastifyReply
    ) => {
      await authService.resetPassword(fastify, request.body.token, request.body.password)
      return reply.send({ message: 'Password reset successful' })
    }
  )
}
