import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { FastifyInstance } from 'fastify'
import { User, Flat } from '../models/index.js'
import { hashPassword, comparePassword } from '../utils/hash.js'
import { config } from '../config/index.js'
import { sanitizeText } from '../utils/sanitize.js'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface SafeUser {
  id: string
  name: string
  email: string
  role: string
}

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  }
}

function generateTokens(user: User): AuthTokens {
  const payload = { id: user.id, email: user.email, role: user.role, flatId: user.flat_id }

  const accessToken = jwt.sign(payload, config.jwtAccessSecret, { expiresIn: '15m' })
  const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: '7d' })

  return { accessToken, refreshToken }
}

async function storeRefreshToken(fastify: FastifyInstance, userId: string, refreshToken: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  // Store with 7-day TTL (matching refresh token expiry)
  await fastify.redis.set(`session:refresh:${userId}`, tokenHash, 'EX', 7 * 24 * 60 * 60)
}

export async function register(
  fastify: FastifyInstance,
  data: {
    block: string
    unitNumber: string
    flatPassword: string
    name: string
    email: string
    phone?: string
    password: string
  }
): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
  // Find flat by block + unit_number
  const flat = await Flat.findOne({
    where: { block: data.block, unit_number: data.unitNumber },
  })

  if (!flat) {
    const err = new Error('Invalid flat or registration password')
    ;(err as any).statusCode = 400
    throw err
  }

  // Check if registration is open
  if (!flat.is_registration_open) {
    const err = new Error('Registration is closed for this flat')
    ;(err as any).statusCode = 400
    throw err
  }

  // Verify flat registration password
  const validFlatPassword = await comparePassword(data.flatPassword, flat.registration_password_hash)
  if (!validFlatPassword) {
    const err = new Error('Invalid flat or registration password')
    ;(err as any).statusCode = 400
    throw err
  }

  // Check email uniqueness
  const existingUser = await User.findOne({ where: { email: data.email } })
  if (existingUser) {
    const err = new Error('Email already registered')
    ;(err as any).statusCode = 409
    throw err
  }

  // Sanitize user-supplied text
  const safeName = sanitizeText(data.name)

  // Hash password and create user
  const passwordHash = await hashPassword(data.password)
  const user = await User.create({
    email: data.email,
    phone: data.phone ?? null,
    password_hash: passwordHash,
    name: safeName,
    flat_id: flat.id,
    role: 'resident',
  })

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user)
  await storeRefreshToken(fastify, user.id, refreshToken)

  return { user: toSafeUser(user), accessToken, refreshToken }
}

export async function login(
  fastify: FastifyInstance,
  data: { email: string; password: string }
): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
  const user = await User.findOne({ where: { email: data.email } })
  if (!user) {
    const err = new Error('Invalid email or password')
    ;(err as any).statusCode = 401
    throw err
  }

  if (!user.is_active) {
    const err = new Error('Account is deactivated')
    ;(err as any).statusCode = 401
    throw err
  }

  const validPassword = await comparePassword(data.password, user.password_hash)
  if (!validPassword) {
    const err = new Error('Invalid email or password')
    ;(err as any).statusCode = 401
    throw err
  }

  const { accessToken, refreshToken } = generateTokens(user)
  await storeRefreshToken(fastify, user.id, refreshToken)

  return { user: toSafeUser(user), accessToken, refreshToken }
}

export async function refresh(
  fastify: FastifyInstance,
  refreshToken: string
): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
  // Verify refresh token
  let decoded: jwt.JwtPayload
  try {
    decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as jwt.JwtPayload
  } catch {
    const err = new Error('Invalid or expired refresh token')
    ;(err as any).statusCode = 401
    throw err
  }

  const userId = decoded.id as string

  // Verify against stored hash in Redis
  const storedHash = await fastify.redis.get(`session:refresh:${userId}`)
  if (!storedHash) {
    const err = new Error('Session expired')
    ;(err as any).statusCode = 401
    throw err
  }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  if (tokenHash !== storedHash) {
    // Token mismatch — possible token reuse attack; invalidate session
    await fastify.redis.del(`session:refresh:${userId}`)
    const err = new Error('Invalid refresh token')
    ;(err as any).statusCode = 401
    throw err
  }

  // Fetch user to get latest data for new token
  const user = await User.findByPk(userId)
  if (!user || !user.is_active) {
    await fastify.redis.del(`session:refresh:${userId}`)
    const err = new Error('User not found or deactivated')
    ;(err as any).statusCode = 401
    throw err
  }

  // Rotate tokens
  const tokens = generateTokens(user)
  await storeRefreshToken(fastify, userId, tokens.refreshToken)

  return { user: toSafeUser(user), ...tokens }
}

export async function logout(fastify: FastifyInstance, userId: string): Promise<void> {
  await fastify.redis.del(`session:refresh:${userId}`)
}

export async function forgotPassword(fastify: FastifyInstance, email: string): Promise<void> {
  const user = await User.findOne({ where: { email } })
  if (!user) {
    // Silently return to prevent email enumeration
    return
  }

  const resetToken = crypto.randomUUID()
  // Store reset token with 1h TTL, mapping to userId
  await fastify.redis.set(`reset:${resetToken}`, user.id, 'EX', 3600)

  // TODO: Send email with reset link. For now, log to console.
  fastify.log.info({ resetToken, userId: user.id }, 'Password reset token generated')
}

export async function resetPassword(
  fastify: FastifyInstance,
  token: string,
  newPassword: string
): Promise<void> {
  const userId = await fastify.redis.get(`reset:${token}`)
  if (!userId) {
    const err = new Error('Invalid or expired reset token')
    ;(err as any).statusCode = 400
    throw err
  }

  const user = await User.findByPk(userId)
  if (!user) {
    const err = new Error('User not found')
    ;(err as any).statusCode = 400
    throw err
  }

  const passwordHash = await hashPassword(newPassword)
  await user.update({ password_hash: passwordHash })

  // Delete the used reset token
  await fastify.redis.del(`reset:${token}`)
}
