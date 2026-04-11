import * as argon2 from 'argon2'

/**
 * Hash a plaintext password using Argon2id.
 * OWASP recommended: type=argon2id, memoryCost=19 MiB, timeCost=2, parallelism=1.
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19456,  // 19 MiB
    timeCost: 2,
    parallelism: 1,
  })
}

/**
 * Compare a plaintext password against an Argon2id hash.
 */
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, plain)
}
