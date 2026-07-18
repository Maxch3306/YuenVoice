// Password hashing via WebCrypto PBKDF2-HMAC-SHA256 — 100% Workers-native, no
// WASM. Chosen because argon2 on Workers requires importing a pre-compiled wasm
// module (hash-wasm's inline WebAssembly.compile is blocked by the runtime).
//
// ⚠️ DECISION PENDING: PBKDF2 does NOT verify legacy node-argon2 hashes. If
// existing users' passwords must survive the migration, we instead package an
// argon2 wasm as a Worker module. See Phase 3 notes.
//
// PHC-like format: pbkdf2-sha256$<iterations>$<saltB64>$<hashB64>
const ITERATIONS = 600_000
const KEY_LEN_BITS = 256

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return btoa(s)
}
function unb64(str: string): Uint8Array {
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function derive(plain: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(plain), 'PBKDF2', false, [
    'deriveBits',
  ])
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    KEY_LEN_BITS,
  )
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const bits = await derive(plain, salt, ITERATIONS)
  return `pbkdf2-sha256$${ITERATIONS}$${b64(salt)}$${b64(bits)}`
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  const parts = hash.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false
  const iterations = Number(parts[1])
  const salt = unb64(parts[2])
  const expected = unb64(parts[3])
  const actual = new Uint8Array(await derive(plain, salt, iterations))
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i]
  return diff === 0
}
