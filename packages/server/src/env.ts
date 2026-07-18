import type { SessionStore } from './durable/SessionStore.js'

// Cloudflare bindings + config exposed to the Worker. Vars come from
// wrangler.jsonc `vars`; secrets from `wrangler secret put` / `.dev.vars`.
export interface Env {
  // Bindings
  DB: D1Database
  UPLOADS: R2Bucket
  SESSION_STORE: DurableObjectNamespace<SessionStore>
  CONFIG: KVNamespace

  // Vars (non-secret)
  NODE_ENV: string
  API_PREFIX: string
  VAPID_SUBJECT: string
  VAPID_PUBLIC_KEY: string
  UPLOAD_MAX_SIZE: string
  ADMIN_EMAIL: string
  ADMIN_NAME: string
  CLIENT_ORIGIN?: string

  // Secrets
  JWT_ACCESS_SECRET: string
  JWT_REFRESH_SECRET: string
  VAPID_PRIVATE_KEY: string
}

// Hono generic: c.env is typed as Env, c.var holds middleware-set values.
export interface AppBindings {
  Bindings: Env
  Variables: {
    // Set by the auth middleware (Phase 3): the verified access-token payload.
    user?: {
      id: string
      email: string
      role: 'resident' | 'oc_committee' | 'mgmt_staff' | 'admin'
      flat_id: string | null
    }
  }
}
