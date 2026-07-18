import { sendPushNotification, type VapidConfig, type PushPayload } from '@mmmike/web-push'
import type { Env } from '../../env.js'
import { userStore } from '../session-store.js'
import { sha256Hex } from '../crypto.js'

// Web Push via @mmmike/web-push (WebCrypto + fetch, RFC 8291) — replaces the
// Node-only `web-push` package. Subscriptions live in the SessionStore Durable
// Object (per-user hash `push`, field = deviceId), replacing the Redis hash.

export interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const PUSH_KEY = 'push'

async function deviceId(endpoint: string): Promise<string> {
  return (await sha256Hex(endpoint)).slice(0, 16)
}

function vapid(env: Env): VapidConfig | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null
  return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT }
}

export async function subscribe(env: Env, userId: string, sub: PushSubscription): Promise<void> {
  await userStore(env, userId).hset(PUSH_KEY, await deviceId(sub.endpoint), JSON.stringify(sub))
}

export async function unsubscribe(env: Env, userId: string, endpoint?: string): Promise<void> {
  const store = userStore(env, userId)
  if (endpoint) await store.hdel(PUSH_KEY, await deviceId(endpoint))
  else await store.del(PUSH_KEY)
}

async function sendToUserInternal(
  env: Env,
  userId: string,
  payload: PushPayload,
  v: VapidConfig,
): Promise<number> {
  const store = userStore(env, userId)
  const subs = await store.hgetall(PUSH_KEY)
  const entries = Object.entries(subs)
  if (entries.length === 0) return 0

  let sent = 0
  await Promise.allSettled(
    entries.map(async ([devId, json]) => {
      try {
        const sub = JSON.parse(json) as PushSubscription
        const ok = await sendPushNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload,
          v,
        )
        if (ok) sent++
        else await store.hdel(PUSH_KEY, devId).catch(() => {}) // dead subscription
      } catch {
        // server error / rate limit — ignore (fire-and-forget)
      }
    }),
  )
  return sent
}

// Fire-and-forget fan-out to every device of the given users.
export async function sendToUsers(
  env: Env,
  userIds: string[],
  payload: { title: string; body: string; category?: string; url?: string },
): Promise<void> {
  const v = vapid(env)
  if (!v) return
  await Promise.allSettled(userIds.map((uid) => sendToUserInternal(env, uid, payload as PushPayload, v)))
}

// Send to all devices of a single user; returns count of devices notified.
export async function sendToUser(
  env: Env,
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<number> {
  const v = vapid(env)
  if (!v) return 0
  return sendToUserInternal(env, userId, payload as PushPayload, v)
}
