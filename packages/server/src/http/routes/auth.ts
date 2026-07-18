import { Hono, type Context } from 'hono'
import { setCookie, deleteCookie, getCookie } from 'hono/cookie'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppBindings } from '../../env.js'
import { getDb } from '../../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import * as authService from '../services/auth.js'

const REFRESH_COOKIE = 'refreshToken'

function setRefreshCookie(c: Context<AppBindings>, token: string) {
  setCookie(c, REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: c.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60,
  })
}

// ── Validation schemas (mirror the previous JSON schemas) ──
const registerBody = z.object({
  block: z.string().min(1),
  floor: z.string().min(1),
  unitNumber: z.string().min(1),
  flatPassword: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
})
const verifyFlatBody = z.object({
  block: z.string().min(1),
  floor: z.string().min(1),
  unitNumber: z.string().min(1),
  flatPassword: z.string().min(1),
})
const loginBody = z.object({ email: z.string().email(), password: z.string().min(1) })
const forgotBody = z.object({ email: z.string().email() })
const resetBody = z.object({ token: z.string().min(1), password: z.string().min(8) })

const auth = new Hono<AppBindings>()

auth.post('/register', zValidator('json', registerBody), async (c) => {
  const db = getDb(c.env.DB)
  const result = await authService.register(c.env, db, c.req.valid('json'))
  setRefreshCookie(c, result.refreshToken)
  return c.json({ user: result.user, accessToken: result.accessToken }, 201)
})

auth.post('/verify-flat-password', zValidator('json', verifyFlatBody), async (c) => {
  const db = getDb(c.env.DB)
  await authService.verifyFlatPassword(db, c.req.valid('json'))
  return c.json({ ok: true })
})

auth.post('/login', zValidator('json', loginBody), async (c) => {
  const db = getDb(c.env.DB)
  const result = await authService.login(c.env, db, c.req.valid('json'))
  setRefreshCookie(c, result.refreshToken)
  return c.json({ user: result.user, accessToken: result.accessToken })
})

auth.post('/refresh', async (c) => {
  const refreshToken = getCookie(c, REFRESH_COOKIE)
  if (!refreshToken) {
    return c.json({ error: 'Unauthorized', message: 'No refresh token provided' }, 401)
  }
  const db = getDb(c.env.DB)
  const result = await authService.refresh(c.env, db, refreshToken)
  setRefreshCookie(c, result.refreshToken)
  return c.json({ user: result.user, accessToken: result.accessToken })
})

auth.post('/logout', requireAuth(), async (c) => {
  const refreshToken = getCookie(c, REFRESH_COOKIE)
  await authService.logout(c.env, c.get('user')!.id, refreshToken)
  deleteCookie(c, REFRESH_COOKIE, { path: '/api/auth' })
  return c.json({ message: 'Logged out' })
})

auth.post('/forgot-password', zValidator('json', forgotBody), async (c) => {
  const db = getDb(c.env.DB)
  await authService.forgotPassword(c.env, db, c.req.valid('json').email)
  return c.json({ message: 'If that email exists, a reset link has been sent' })
})

auth.post('/reset-password', zValidator('json', resetBody), async (c) => {
  const db = getDb(c.env.DB)
  const { token, password } = c.req.valid('json')
  await authService.resetPassword(c.env, db, token, password)
  return c.json({ message: 'Password reset successful' })
})

export default auth
