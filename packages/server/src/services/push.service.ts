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

/**
 * Store a push subscription for a user in Redis.
 */
export async function subscribe(
  redis: Redis,
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  await redis.set(`push:sub:${userId}`, JSON.stringify(subscription))
}

/**
 * Remove a push subscription for a user from Redis.
 */
export async function unsubscribe(redis: Redis, userId: string): Promise<void> {
  await redis.del(`push:sub:${userId}`)
}

/**
 * Send Web Push notifications to a list of users.
 * Fire-and-forget: errors are logged but do not propagate.
 */
export async function sendToUsers(
  redis: Redis,
  userIds: string[],
  payload: { title: string; body: string; category: string }
): Promise<void> {
  if (!config.vapidPublicKey || !config.vapidPrivateKey) {
    return // Push not configured
  }

  const payloadStr = JSON.stringify(payload)

  const sends = userIds.map(async (userId) => {
    try {
      const subJson = await redis.get(`push:sub:${userId}`)
      if (!subJson) return

      const subscription = JSON.parse(subJson) as PushSubscription
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        payloadStr
      )
    } catch (err: any) {
      // 410 = subscription expired — remove it
      if (err?.statusCode === 410) {
        await redis.del(`push:sub:${userId}`).catch(() => {})
      }
      // Other errors are silently ignored (fire-and-forget)
    }
  })

  await Promise.allSettled(sends)
}
