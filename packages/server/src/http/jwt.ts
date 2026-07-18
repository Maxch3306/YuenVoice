import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

// JWT sign/verify via jose (WebCrypto, HS256) — replaces jsonwebtoken and
// @fastify/jwt. Payload shape matches the previous implementation so the client
// and route handlers are unaffected.

export interface UserPayload {
  id: string
  email: string
  role: 'resident' | 'oc_committee' | 'mgmt_staff' | 'admin'
  flatId: string | null
  sid: string
}

const key = (secret: string) => new TextEncoder().encode(secret)

async function sign(payload: UserPayload, secret: string, expiresIn: string): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key(secret))
}

export const signAccessToken = (p: UserPayload, secret: string) => sign(p, secret, '15m')
export const signRefreshToken = (p: UserPayload, secret: string) => sign(p, secret, '7d')

// Verifies signature + expiry; throws on invalid/expired. Returns the payload.
export async function verifyToken(token: string, secret: string): Promise<UserPayload & JWTPayload> {
  const { payload } = await jwtVerify(token, key(secret))
  return payload as UserPayload & JWTPayload
}
