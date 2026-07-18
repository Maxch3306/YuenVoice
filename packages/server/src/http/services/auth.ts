import { and, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { flats, users } from '../../db/schema.js'
import type { Env } from '../../env.js'
import { hashPassword, comparePassword } from '../../utils/hash.js'
import { sanitizeText } from '../sanitize.js'
import { sha256Hex } from '../crypto.js'
import { signAccessToken, signRefreshToken, verifyToken, type UserPayload } from '../jwt.js'
import { userStore, tokenStore } from '../session-store.js'
import { HttpError } from '../errors.js'

type UserRow = typeof users.$inferSelect
type FlatRow = typeof flats.$inferSelect

export interface SafeUser {
  id: string
  name: string
  email: string
  role: string
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour
const SESSION_KEY = 'session'
const RESET_KEY = 'reset'

function toSafeUser(u: UserRow): SafeUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role }
}

async function generateTokens(env: Env, user: UserRow) {
  const sessionId = crypto.randomUUID()
  const payload: UserPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    flatId: user.flat_id,
    sid: sessionId,
  }
  const accessToken = await signAccessToken(payload, env.JWT_ACCESS_SECRET)
  const refreshToken = await signRefreshToken(payload, env.JWT_REFRESH_SECRET)
  return { accessToken, refreshToken, sessionId }
}

async function storeRefreshToken(env: Env, userId: string, sessionId: string, refreshToken: string) {
  const tokenHash = await sha256Hex(refreshToken)
  await userStore(env, userId).hset(SESSION_KEY, sessionId, tokenHash, SESSION_TTL_MS)
}

export async function verifyFlatPassword(
  db: Db,
  data: { block: string; floor: string; unitNumber: string; flatPassword: string },
): Promise<FlatRow> {
  const [flat] = await db
    .select()
    .from(flats)
    .where(
      and(
        eq(flats.block, data.block),
        eq(flats.floor, data.floor),
        eq(flats.unit_number, data.unitNumber),
      ),
    )
    .limit(1)

  if (!flat) throw new HttpError(400, 'Invalid flat or registration password')
  if (!flat.is_registration_open) throw new HttpError(400, 'Registration is closed for this flat')
  if (data.flatPassword !== flat.registration_password)
    throw new HttpError(400, 'Invalid flat or registration password')

  return flat
}

export async function register(
  env: Env,
  db: Db,
  data: {
    block: string
    floor: string
    unitNumber: string
    flatPassword: string
    name: string
    email: string
    phone?: string
    password: string
  },
): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
  const flat = await verifyFlatPassword(db, data)

  const [existing] = await db.select().from(users).where(eq(users.email, data.email)).limit(1)
  if (existing) throw new HttpError(409, 'Email already registered')

  const safeName = sanitizeText(data.name)
  const passwordHash = await hashPassword(data.password)

  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      phone: data.phone ?? null,
      password_hash: passwordHash,
      name: safeName,
      flat_id: flat.id,
      role: 'resident',
    })
    .returning()

  const { accessToken, refreshToken, sessionId } = await generateTokens(env, user)
  await storeRefreshToken(env, user.id, sessionId, refreshToken)

  return { user: toSafeUser(user), accessToken, refreshToken }
}

export async function login(
  env: Env,
  db: Db,
  data: { email: string; password: string },
): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
  const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1)
  if (!user) throw new HttpError(401, 'Invalid email or password')
  if (!user.is_active) throw new HttpError(401, 'Account is deactivated')

  const valid = await comparePassword(data.password, user.password_hash)
  if (!valid) throw new HttpError(401, 'Invalid email or password')

  const { accessToken, refreshToken, sessionId } = await generateTokens(env, user)
  await storeRefreshToken(env, user.id, sessionId, refreshToken)

  return { user: toSafeUser(user), accessToken, refreshToken }
}

export async function refresh(
  env: Env,
  db: Db,
  refreshToken: string,
): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
  let decoded: UserPayload
  try {
    decoded = await verifyToken(refreshToken, env.JWT_REFRESH_SECRET)
  } catch {
    throw new HttpError(401, 'Invalid or expired refresh token')
  }

  const userId = decoded.id
  const sessionId = decoded.sid
  if (!sessionId) throw new HttpError(401, 'Invalid refresh token')

  const store = userStore(env, userId)
  const storedHash = await store.hget(SESSION_KEY, sessionId)
  if (!storedHash) throw new HttpError(401, 'Session expired')

  const tokenHash = await sha256Hex(refreshToken)
  if (tokenHash !== storedHash) {
    await store.hdel(SESSION_KEY, sessionId)
    throw new HttpError(401, 'Invalid refresh token')
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user || !user.is_active) {
    await store.hdel(SESSION_KEY, sessionId)
    throw new HttpError(401, 'User not found or deactivated')
  }

  // Rotate: remove old session, issue a new one.
  await store.hdel(SESSION_KEY, sessionId)
  const { accessToken, refreshToken: newRefresh, sessionId: newSid } = await generateTokens(env, user)
  await storeRefreshToken(env, userId, newSid, newRefresh)

  return { user: toSafeUser(user), accessToken, refreshToken: newRefresh }
}

export async function logout(env: Env, userId: string, refreshToken?: string): Promise<void> {
  const store = userStore(env, userId)
  if (refreshToken) {
    try {
      const decoded = await verifyToken(refreshToken, env.JWT_REFRESH_SECRET)
      if (decoded.sid) {
        await store.hdel(SESSION_KEY, decoded.sid)
        return
      }
    } catch {
      // fall through to clear all sessions
    }
  }
  await store.del(SESSION_KEY)
}

export async function forgotPassword(env: Env, db: Db, email: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) return // silent — prevent enumeration

  const resetToken = crypto.randomUUID()
  await tokenStore(env, resetToken).sset(RESET_KEY, user.id, RESET_TTL_MS)

  // TODO: send email with reset link. For now, surface in logs.
  console.info(JSON.stringify({ msg: 'Password reset token generated', resetToken, userId: user.id }))
}

export async function resetPassword(
  env: Env,
  db: Db,
  token: string,
  newPassword: string,
): Promise<void> {
  const store = tokenStore(env, token)
  const userId = await store.sget(RESET_KEY)
  if (!userId) throw new HttpError(400, 'Invalid or expired reset token')

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new HttpError(400, 'User not found')

  const passwordHash = await hashPassword(newPassword)
  await db.update(users).set({ password_hash: passwordHash }).where(eq(users.id, userId))
  await store.del(RESET_KEY)
}
