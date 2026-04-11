import crypto from 'node:crypto'
import webpush from 'web-push'
import type Redis from 'ioredis'
import { config } from '../config/index.js'

export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

// Configure VAPID keys if available
if (config.vapidPublicKey && config.vapidPrivateKey) {
  webpush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey
  )
}

/** Derive a short device ID from the push endpoint URL. */
function deviceId(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 16)
}

/**
 * Store a push subscription for a user in Redis (supports multiple devices).
 * Uses a hash: push:sub:{userId} → { deviceId: JSON subscription }
 */
export async function subscribe(
  redis: Redis,
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  const key = `push:sub:${userId}`
  // Migrate legacy string-type keys from single-device era
  const keyType = await redis.type(key)
  if (keyType === 'string') {
    await redis.del(key)
  }
  await redis.hset(key, deviceId(subscription.endpoint), JSON.stringify(subscription))
}

/**
 * Remove a specific push subscription for a user by endpoint.
 */
export async function unsubscribe(redis: Redis, userId: string, endpoint?: string): Promise<void> {
  const key = `push:sub:${userId}`
  const keyType = await redis.type(key)
  if (keyType === 'string') {
    await redis.del(key)
    return
  }
  if (endpoint) {
    await redis.hdel(key, deviceId(endpoint))
  } else {
    // No endpoint provided — remove all subscriptions for this user
    await redis.del(key)
  }
}

/**
 * Send Web Push notifications to ALL devices of the given users.
 * Fire-and-forget: errors are logged but do not propagate.
 */
export async function sendToUsers(
  redis: Redis,
  userIds: string[],
  payload: { title: string; body: string; category?: string; url?: string }
): Promise<void> {
  if (!config.vapidPublicKey || !config.vapidPrivateKey) {
    return // Push not configured
  }

  const payloadStr = JSON.stringify(payload)

  const sends = userIds.map(async (userId) => {
    try {
      const key = `push:sub:${userId}`
      const keyType = await redis.type(key)

      // Migrate legacy string keys
      if (keyType === 'string') {
        const subJson = await redis.get(key)
        if (subJson) {
          const sub = JSON.parse(subJson) as PushSubscription
          await redis.del(key)
          await redis.hset(key, deviceId(sub.endpoint), subJson)
        }
      }

      const subs = await redis.hgetall(key)
      if (!subs || Object.keys(subs).length === 0) return

      await Promise.allSettled(
        Object.entries(subs).map(async ([devId, subJson]) => {
          try {
            const subscription = JSON.parse(subJson) as PushSubscription
            await webpush.sendNotification(
              { endpoint: subscription.endpoint, keys: subscription.keys },
              payloadStr
            )
          } catch (err: any) {
            if (err?.statusCode === 410) {
              await redis.hdel(key, devId).catch(() => {})
            }
          }
        })
      )
    } catch {
      // Silently ignore per-user errors (fire-and-forget)
    }
  })

  await Promise.allSettled(sends)
}

/**
 * Send push to all devices of a single user. Returns count of devices notified.
 */
export async function sendToUser(
  redis: Redis,
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<number> {
  if (!config.vapidPublicKey || !config.vapidPrivateKey) {
    return 0
  }

  const key = `push:sub:${userId}`
  const keyType = await redis.type(key)

  // Migrate legacy string keys
  if (keyType === 'string') {
    const subJson = await redis.get(key)
    if (subJson) {
      const sub = JSON.parse(subJson) as PushSubscription
      await redis.del(key)
      await redis.hset(key, deviceId(sub.endpoint), subJson)
    }
  }

  const subs = await redis.hgetall(key)
  if (!subs || Object.keys(subs).length === 0) {
    return 0
  }

  let sent = 0
  await Promise.allSettled(
    Object.entries(subs).map(async ([devId, subJson]) => {
      try {
        const subscription = JSON.parse(subJson) as PushSubscription
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          JSON.stringify(payload)
        )
        sent++
      } catch (err: any) {
        if (err?.statusCode === 410) {
          await redis.hdel(key, devId).catch(() => {})
        }
      }
    })
  )
  return sent
}
