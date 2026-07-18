import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../env.js'

// Generic TTL key-value + hash store backed by Durable Object storage. Replaces
// the Redis hashes the app used for:
//   - session:refresh:{userId}  (hash sessionId -> sha256(refreshToken), 7d TTL)
//   - reset:{token}             (string userId, 1h TTL)
//   - push:sub:{userId}         (hash deviceId -> JSON subscription, no TTL)
//
// Callers shard by picking the DO instance id (user id, or "reset:<token>"),
// giving strong per-entity consistency — important for refresh-token rotation.
// DO storage has no native TTL, so each entry carries an `e` (expiresAt ms);
// reads lazy-expire, and an hourly alarm sweeps the rest.

interface Entry {
  v: string
  e: number | null
}

const SWEEP_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

export class SessionStore extends DurableObject<Env> {
  private hk(key: string, field: string) {
    return `h:${key}:${field}`
  }
  private sk(key: string) {
    return `s:${key}`
  }

  private async ensureSweep() {
    if ((await this.ctx.storage.getAlarm()) == null) {
      await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS)
    }
  }

  // ── Hash operations ──
  async hset(key: string, field: string, value: string, ttlMs?: number): Promise<void> {
    const e = ttlMs ? Date.now() + ttlMs : null
    await this.ctx.storage.put(this.hk(key, field), { v: value, e } satisfies Entry)
    if (e) await this.ensureSweep()
  }

  async hget(key: string, field: string): Promise<string | null> {
    const k = this.hk(key, field)
    const entry = await this.ctx.storage.get<Entry>(k)
    if (!entry) return null
    if (entry.e != null && entry.e < Date.now()) {
      await this.ctx.storage.delete(k)
      return null
    }
    return entry.v
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const prefix = `h:${key}:`
    const map = await this.ctx.storage.list<Entry>({ prefix })
    const now = Date.now()
    const out: Record<string, string> = {}
    const expired: string[] = []
    for (const [k, entry] of map) {
      if (entry.e != null && entry.e < now) expired.push(k)
      else out[k.slice(prefix.length)] = entry.v
    }
    if (expired.length) await this.ctx.storage.delete(expired)
    return out
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.ctx.storage.delete(this.hk(key, field))
  }

  // ── String operations ──
  async sset(key: string, value: string, ttlMs?: number): Promise<void> {
    const e = ttlMs ? Date.now() + ttlMs : null
    await this.ctx.storage.put(this.sk(key), { v: value, e } satisfies Entry)
    if (e) await this.ensureSweep()
  }

  async sget(key: string): Promise<string | null> {
    const k = this.sk(key)
    const entry = await this.ctx.storage.get<Entry>(k)
    if (!entry) return null
    if (entry.e != null && entry.e < Date.now()) {
      await this.ctx.storage.delete(k)
      return null
    }
    return entry.v
  }

  // Delete a string key and every hash field under it (mirrors Redis DEL of a key).
  async del(key: string): Promise<void> {
    await this.ctx.storage.delete(this.sk(key))
    const map = await this.ctx.storage.list({ prefix: `h:${key}:` })
    if (map.size) await this.ctx.storage.delete([...map.keys()])
  }

  async alarm(): Promise<void> {
    const all = await this.ctx.storage.list<Entry>()
    const now = Date.now()
    const expired: string[] = []
    let hasFuture = false
    for (const [k, entry] of all) {
      if (entry && typeof entry === 'object' && 'e' in entry) {
        if (entry.e != null && entry.e < now) expired.push(k)
        else if (entry.e != null) hasFuture = true
      }
    }
    if (expired.length) await this.ctx.storage.delete(expired)
    if (hasFuture) await this.ctx.storage.setAlarm(now + SWEEP_INTERVAL_MS)
  }
}
