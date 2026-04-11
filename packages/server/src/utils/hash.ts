import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

/**
 * Hash a plaintext password using bcrypt with cost factor 12.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

/**
 * Compare a plaintext password against a bcrypt hash.
 */
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
