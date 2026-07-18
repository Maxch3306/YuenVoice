import type { Env } from '../env.js'

// Resolve SessionStore Durable Object stubs. Sharding by entity gives strong
// per-user / per-token consistency (important for refresh-token rotation).

// Per-user store: holds `session:refresh:{userId}` and `push:sub:{userId}`.
export function userStore(env: Env, userId: string) {
  return env.SESSION_STORE.get(env.SESSION_STORE.idFromName(`u:${userId}`))
}

// Per-token store: holds a single `reset:{token}` -> userId mapping.
export function tokenStore(env: Env, token: string) {
  return env.SESSION_STORE.get(env.SESSION_STORE.idFromName(`t:${token}`))
}
