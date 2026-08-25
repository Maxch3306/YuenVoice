# YUENVOICE — Architecture Document

> Version: 2.0
> Last Updated: 2026-08-25
> Reference: [PRD.md](PRD.md) · [deploy-cloudflare.md](deploy-cloudflare.md)

---

## 1. System Overview / 系統概覽

YUENVOICE is a monorepo PWA that runs **entirely on Cloudflare**. A single Worker (Hono)
serves both the REST API and the Vite-built React SPA (uploaded as static assets). State
lives in Cloudflare primitives: D1 for relational data, a Durable Object for sessions and
tokens, R2 for uploads, KV for mutable config.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (PWA)                         │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  │
│  │  React 19  │  │ shadcn/ui │  │  Zustand  │  │  SW/Push │  │
│  │ + Router   │  │ Tailwind  │  │  State    │  │  Offline │  │
│  └─────┬─────┘  └───────────┘  └─────┬────┘  └─────┬────┘  │
│        │                              │              │       │
│        └──────────────┬───────────────┘              │       │
│                       ▼                              ▼       │
│              Axios HTTP Client              Service Worker   │
└───────────────────────┬──────────────────────────┬──────────┘
                        │ HTTPS / JSON             │ Web Push
                        ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│         Cloudflare Worker  (single deployment)              │
│                                                             │
│  Static assets (packages/client/dist)  ← everything not     │
│    not_found_handling: SPA               /api/* or /uploads/*│
│                                                             │
│  Hono app  (run_worker_first: /api/*, /uploads/*)           │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐  │
│  │ requireAuth│ │requireRole│  │  Routes  │  │  Web Push │  │
│  │ (jose JWT) │ │  (RBAC)   │  │ Handlers │  │  Service  │  │
│  └─────┬────┘  └─────┬─────┘  └─────┬────┘  └─────┬─────┘  │
│        └──────────────┴──────────────┘              │       │
│                       ▼                             │       │
│              Service layer (src/http/services)      │       │
│         ┌──────────┬──────────┬──────────┐          │       │
└─────────┼──────────┼──────────┼──────────┼──────────┼───────┘
          ▼          ▼          ▼          ▼          ▼
    ┌──────────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌──────────┐
    │  D1 (DB) │ │Durable │ │  R2  │ │KV      │ │ Web Push │
    │  Drizzle │ │Object  │ │UPLOAD│ │CONFIG  │ │  (VAPID) │
    │          │ │Session │ │  S   │ │admin:  │ │          │
    │          │ │Store   │ │      │ │password│ │          │
    └──────────┘ └────────┘ └──────┘ └────────┘ └──────────┘
```

**Bindings** (declared in `packages/server/wrangler.jsonc`, typed in `src/env.ts`):

| Binding | Resource | Purpose |
|---------|----------|---------|
| `DB` | D1 `yuenvoice` | All relational data (SQLite) |
| `SESSION_STORE` | Durable Object `SessionStore` | Refresh-token hashes, push subscriptions, reset tokens |
| `UPLOADS` | R2 `yuenvoice-uploads` | Report attachments, post images, OC documents |
| `CONFIG` | KV | Mutable runtime config — `admin:password` |

> **Legacy note.** `packages/server/` still contains the retired Fastify + Sequelize +
> PostgreSQL + Redis implementation (`src/index.ts`, `src/app.ts`, `src/routes/`,
> `src/services/`, `src/models/`, `src/plugins/`, `migrations/`, `seeders/`, `src/__tests__/`).
> It is not deployed and not reachable from `src/worker.ts`. This document describes the
> **live** Workers implementation under `src/http/` and `src/db/`.

---

## 2. Project Structure / 項目結構

```
yuenvoice/
├── docs/                        # Documentation
│   ├── PRD.md
│   ├── architecture.md
│   ├── deploy-cloudflare.md     # Provisioning / secrets / deploy runbook
│   ├── development-plan.md
│   └── ui/                      # Sitemap + per-page wireframes
├── design-system/yuenvoice/     # MASTER.md + design tokens
├── .github/workflows/
│   └── deploy-cloudflare.yml    # CI: build SPA, migrate D1, wrangler deploy
├── packages/
│   ├── client/                  # Frontend (Vite + React 19)
│   │   ├── public/
│   │   │   ├── manifest.json    # PWA manifest
│   │   │   ├── sw.js            # Service Worker
│   │   │   └── icons/
│   │   ├── src/
│   │   │   ├── main.tsx         # Entry
│   │   │   ├── App.tsx          # Router
│   │   │   ├── components/
│   │   │   │   └── ui/          # shadcn/ui components
│   │   │   ├── pages/
│   │   │   │   ├── auth/        # Login, Register, Forgot/Reset password
│   │   │   │   ├── reports/     # List, Create, Detail
│   │   │   │   ├── discussion/  # Boards, Posts, Create, Detail
│   │   │   │   ├── oc/          # Document list + view
│   │   │   │   ├── notifications/ # Center + Compose
│   │   │   │   ├── profile/     # MyFlats (multi-unit owner)
│   │   │   │   └── admin/       # Dashboard, Users, Flats, AuditLogs
│   │   │   ├── hooks/
│   │   │   ├── stores/          # Zustand (auth, theme)
│   │   │   ├── services/        # API client + TanStack Query hooks
│   │   │   ├── lib/             # i18n, translations, utils
│   │   │   └── types/
│   │   ├── components.json      # shadcn config
│   │   └── vite.config.ts
│   │
│   └── server/                  # Backend (Cloudflare Worker — Hono 4, ESM)
│       ├── src/
│       │   ├── worker.ts        # Worker entry — exports fetch + SessionStore DO
│       │   ├── env.ts           # Env bindings + Hono AppBindings types
│       │   ├── http/            # ── LIVE API implementation ──
│       │   │   ├── app.ts       # Hono app; route mount order matters (see §4.1)
│       │   │   ├── errors.ts    # HttpError → JSON via app.onError
│       │   │   ├── jwt.ts       # jose sign/verify (access + refresh)
│       │   │   ├── crypto.ts    # sha256Hex (token hashing)
│       │   │   ├── session-store.ts  # userStore() / tokenStore() DO stubs
│       │   │   ├── upload.ts    # magic-byte validation + R2 put
│       │   │   ├── sanitize.ts  # xss-based HTML/text sanitizers
│       │   │   ├── audit.ts     # logAudit()
│       │   │   ├── middleware/
│       │   │   │   ├── auth.ts  # requireAuth() / optionalAuth()
│       │   │   │   └── rbac.ts  # requireRole(...roles)
│       │   │   ├── routes/      # auth, reports, discussions, oc-documents,
│       │   │   │                # notifications, user-flats, admin, flats, uploads
│       │   │   └── services/    # auth, reports, discussions, oc-documents,
│       │   │                    # notifications, push, user-flats, admin
│       │   ├── db/
│       │   │   ├── schema.ts    # Drizzle schema — 15 D1 tables + relations
│       │   │   └── client.ts    # drizzle(env.DB)
│       │   ├── durable/
│       │   │   └── SessionStore.ts  # hset/hget/hgetall/hdel/sset/sget/del + alarm TTL sweep
│       │   ├── utils/hash.ts    # PBKDF2-HMAC-SHA256 (WebCrypto) — live
│       │   └── ── retired (Fastify path, not deployed) ──
│       │       index.ts, app.ts, config/, plugins/, routes/, services/,
│       │       models/, middleware/rate-limit.ts, utils/{setup,env-validator,
│       │       pagination,audit,sanitize}.ts, __tests__/
│       ├── drizzle/             # Generated D1 migrations (0000_init.sql, meta/)
│       ├── drizzle.config.ts
│       ├── scripts/seed.mjs     # Generates seed.sql (flats + discussion boards)
│       ├── migrations/          # retired Sequelize migrations (18 .cjs)
│       ├── seeders/             # retired Sequelize seeders
│       ├── wrangler.jsonc       # Bindings, vars, assets, DO migrations
│       ├── worker-configuration.d.ts  # Generated by `wrangler types`
│       ├── .dev.vars.example    # Local secrets template
│       ├── tsconfig.worker.json # Worker typecheck config
│       └── package.json
│
├── package.json                 # Root workspace config
├── pnpm-workspace.yaml
├── .env.example
└── LICENSE
```

---

## 3. Frontend Architecture / 前端架構

### 3.1 Routing

React Router v7 with layout-based routing. Protected routes redirect unauthenticated users to `/login`.

```
/                          → Redirect to /reports (default home)
/login                     → Login page
/register                  → Registration (flat password flow)
/forgot-password           → Forgot password (server issues a token; no email delivery yet)
/reset-password            → Reset password (consumes the token from the DO token store)
/reports                   → Incident reports list (residents see own, others see all)
/reports/new               → Create new report (committee blocked)
/reports/:id               → Report detail + status timeline
/discussion                → Board list
/discussion/:boardId       → Posts in board
/discussion/:boardId/new   → Create new post (committee blocked)
/discussion/post/:postId   → Post detail + comments
/oc                        → OC documents list
/oc/:id                    → Document viewer (file or link)
/notifications             → Notification center
/notifications/compose     → Compose notification (mgmt/admin)
/profile/flats             → My flats (multi-unit owner — link/unlink units)
/admin                     → Admin dashboard (admin only)
/admin/users               → User management
/admin/flats               → Flat & password management
/admin/audit-logs          → Audit log viewer
```

### 3.2 State Management

**Zustand** for lightweight client state. No global store — each domain has its own store.

| Store | Responsibility |
|-------|---------------|
| `useAuthStore` (`stores/auth-store.ts`) | Current user, in-memory access token, isAuthenticated flag |
| `useNotificationStore` (`stores/notification-store.ts`) | Mirror of the notification list + derived unread count for the header badge |

Theme is **not** a Zustand store — it lives in `components/theme-provider.tsx` (React context
+ `useTheme()`), covering light / dark / system and the `D` keyboard-shortcut toggle.

Server state (reports, posts, documents, notifications, flats, users) is managed via
**TanStack Query** for caching, refetching, and optimistic updates. Service files
(`src/services/*.ts`) export the Query hooks alongside the raw API calls; the notification
store is populated from the notifications query rather than fetching independently.

### 3.3 API Client

A single Axios instance configured with:
- Base URL from `VITE_API_URL` (empty in the single-Worker deployment — the SPA and API are same-origin)
- Request interceptor: attach access token from `useAuthStore`
- Response interceptor: on 401, attempt token refresh; if refresh fails, redirect to login

In local development the Vite dev server (5173) proxies `/api` and `/uploads` to
`http://localhost:3001`. Point that proxy at `http://localhost:8787` when running the
Worker via `wrangler dev`.

### 3.4 PWA Strategy

| Asset | Strategy | Reason |
|-------|----------|--------|
| App shell (HTML, JS, CSS) | Cache-first | Fast repeat loads |
| API responses | Network-first | Data freshness |
| Uploaded images | Cache-first | Reduce bandwidth |
| Fonts / icons | Cache-first | Rarely change |

`public/sw.js` implements cache-first, network-first, and stale-while-revalidate handlers
plus a `push` listener for Web Push display.

**Offline behaviour:** read-only access to whatever is already cached. Write actions fail
while offline — the IndexedDB write queue with background sync described in the original
plan is **not implemented**; `OfflineBanner` surfaces the state instead.

---

## 4. Backend Architecture / 後端架構

### 4.1 Hono App Composition

`src/http/app.ts` builds the Hono app that `src/worker.ts` exports as `fetch`:

```
Hono app
├── secureHeaders()             → security headers (CSP left to the asset layer)
├── CORS (conditional)          → only when CLIENT_ORIGIN is set; same-origin by default
├── GET /api/health             → { status: 'ok', runtime: 'workers' }
└── Route groups
    ├── /api/auth               → auth.ts
    ├── /api/reports            → reports.ts
    ├── /api/oc-documents       → oc-documents.ts
    ├── /api/notifications      → notifications.ts
    ├── /api/push               → notifications.ts (named export `push`)
    ├── /api/users              → user-flats.ts   (/me/flats)
    ├── /api/admin              → admin.ts
    ├── /api/flats              → flats.ts        (public block/floor/unit lookups)
    ├── /api                    → discussions.ts  (/boards, /posts) — MOUNTED LAST
    └── /uploads                → uploads.ts      (R2 object serving, outside /api)
```

> **Mount order is load-bearing.** `discussions.ts` declares its own
> `use('*', requireAuth())` and mounts at the bare `/api` prefix. Registered before its
> siblings it would gate them — including the intentionally public `/api/flats/*` used by
> the registration form. Keep it last.

Unmatched requests fall through to `app.notFound` (JSON 404); thrown `HttpError`s are
serialized by `app.onError`, anything else becomes a logged 500.

### 4.2 Request Lifecycle

```
Incoming Request
    │
    ▼
[ Cloudflare edge ]  assets.run_worker_first: /api/*, /uploads/*
    │                 everything else → static asset or index.html (SPA fallback)
    ▼
[ secureHeaders / conditional CORS ]
    │
    ▼
[ Route Match ]
    │
    ▼
[ requireAuth() ]                    ← verify access JWT (jose), set c.var.user
    │
    ▼
[ requireRole(...) ]                 ← check c.var.user.role against the route policy
    │
    ▼
[ zValidator(schema) ]               ← Zod body/query/param validation
    │
    ▼
[ Route Handler ]                    ← resolve bindings from c.env, call service layer
    │
    ▼
[ Service Layer ]                    ← business logic
    │
    ├──→ Drizzle → D1                ← data persistence
    ├──→ SessionStore (Durable Object)← refresh tokens, push subs, reset tokens
    ├──→ R2                          ← upload storage
    └──→ Web Push (VAPID)            ← fire-and-forget dispatch
    │
    ▼
[ c.json(...) ]                      ← JSON response
```

There is **no rate-limiting layer on the Worker path** — see §8.2.

### 4.3 Service Layer Pattern

Route handlers delegate to modules in `src/http/services/`. Services contain all business
logic and are responsible for:

- Data validation beyond schema (e.g., checking flat password, notification target resolution)
- Drizzle queries against D1
- Durable Object reads/writes for session and token state
- Triggering web-push notifications (fire-and-forget — failures don't break the request)
- Writing audit log entries
- State-machine transitions (e.g., auto-reopen on resident follow-up)

Bindings are never module-level singletons: every service takes `env` and/or a `Db` handle
from the request context, because a Workers isolate is reused across requests and tenants.

```typescript
// http/routes/reports.ts — oc_committee is absent from writerRoles (review-only)
const reports = new Hono<AppBindings>()
reports.use('*', requireAuth())

reports.post('/', requireRole(...writerRoles), async (c) => {
  const db = getDb(c.env.DB)
  const report = await reportService.create(db, c.get('user')!.id, { /* ... */ })
  return c.json(report, 201)
})
```

JSON endpoints use `zValidator('json' | 'query', schema)`; multipart endpoints (report
creation, post images, OC document upload) read `await c.req.formData()` and validate
inline, since Zod can't describe a `FormData` file part.

### 4.4 Authentication Flow

```
┌──────────┐     POST /auth/register      ┌──────────────┐
│  Client   │ ──────────────────────────→  │  Auth Route   │
│           │  { block, unit, flat_pwd,    │               │
│           │    name, email, password }   │  Validate     │
│           │                              │  flat password │
│           │  ◄────────────────────────── │  Create user   │
│           │  { accessToken, refreshToken }│  Return JWT   │
└──────────┘                               └──────────────┘

┌──────────┐     POST /auth/login          ┌──────────────┐
│  Client   │ ──────────────────────────→  │  Auth Route   │
│           │  { email, password }         │               │
│           │                              │  Verify creds  │
│           │  ◄────────────────────────── │  Return JWT   │
│           │  { accessToken, refreshToken }│               │
└──────────┘                               └──────────────┘

┌──────────┐     POST /auth/refresh        ┌──────────────┐
│  Client   │ ──────────────────────────→  │  Auth Route   │
│           │  { refreshToken }            │               │
│           │                              │  Verify token  │
│           │  ◄────────────────────────── │  Rotate pair  │
│           │  { accessToken, refreshToken }│               │
└──────────┘                               └──────────────┘
```

**Token storage (client):**
- Access token: in-memory (Zustand store) — never in localStorage
- Refresh token: httpOnly secure cookie

**Token storage (server):** refresh tokens are never persisted in plaintext. On login the
service writes `sha256Hex(refreshToken)` into the per-user Durable Object under
`session:refresh` keyed by session id (7-day TTL), so revoking one device leaves the user's
other sessions alive. Refresh rotates the pair and replaces the stored hash.

**Admin bootstrap.** There is no seeded admin row. `CONFIG['admin:password']` in KV is the
source of truth: on admin login the auth service reads it, creates or updates the admin
user in D1 to match, then authenticates. Rotating the admin password is a single
`wrangler kv key put` — no redeploy, no migration.

**Password reset.** `POST /auth/forgot-password` mints a UUID token and stores
`reset → userId` in the per-token Durable Object with a 1-hour TTL, returning 200
regardless of whether the email exists (no account enumeration). Delivery is **not yet
implemented** — the token is currently only written to the Worker log.

---

## 5. Database Architecture / 數據庫架構

### 5.1 Entity Relationship Diagram

```
┌──────────┐ 1     N ┌───────────────────┐ 1   N ┌─────────────────┐
│   Flat   │─────────│      User         │───────│ IncidentReport  │
│          │ primary │                   │       │                 │
│ block    │ flat_id │ email             │       │ type            │
│ floor    │ (null-  │ name              │       │ status          │
│ unit_no  │  able)  │ role              │       │ priority        │
│ reg_pwd  │         │ flat_id (FK,      │       │ reporter_id     │
│          │         │   nullable)       │       │ location_*      │
└────┬─────┘         └─────────┬─────────┘       └────────┬────────┘
     │                         │                          │
     │  ┌──────────────────────┤                          │
     │  │  N        N          │                    ┌─────┴──────┐
     │  ▼                      │                    ▼            ▼
     │  ┌──────────────┐       │              ┌────────────┐ ┌──────────────┐
     └──│  UserFlat    │       │              │ Incident   │ │ Incident     │
        │ (join table) │       │              │ Comment    │ │ Attachment   │
        │ user_id (PK) │       │              │ is_internal│ │              │
        │ flat_id (PK) │       │              └────────────┘ └──────────────┘
        │ linked_at    │       │
        └──────────────┘       │
                               │ N
                      ┌────────┴──────┐
                      │ DiscussionPost│
                      │  board_id     │
                      │  author_id    │
                      │  is_anonymous │
                      │  is_hidden    │
                      │  is_pinned    │
                      └───────┬───────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
         ┌──────────┐ ┌─────────────┐ ┌──────────────┐
         │PostImage │ │PostComment  │ │PostReaction  │
         │          │ │is_anonymous │ │type='like'   │
         └──────────┘ └─────────────┘ └──────────────┘

┌──────────────┐                ┌────────────────┐ 1   N ┌──────────────────┐
│ OcDocument   │                │  Notification  │───────│ UserNotification │
│              │                │                │       │                  │
│ publisher_id │                │ sender_id      │       │ user_id (FK)     │
│ type (6)     │                │ category       │       │ is_read          │
│ file_path    │                │ target_type    │       │ read_at          │
│ external_url │                │ target_block   │       └──────────────────┘
│ link_type    │                │ target_floor   │
└──────────────┘                └────────────────┘

┌──────────────┐
│  AuditLog    │
│ user_id (FK) │
│ action       │
│ entity_type  │
│ entity_id    │
│ metadata JSON│
└──────────────┘
```

**Key relationships:**

- `User` ↔ `Flat` is many-to-many via `UserFlat` (a resident can own multiple flats; a flat can have multiple co-owners). The legacy `User.flat_id` column remains as the **primary** flat for backward compatibility and for default `block`/`floor` resolution; additional flats are linked through `UserFlat`.
- `User.flat_id` is **nullable** — admins create non-resident mgmt/committee/admin accounts that aren't bound to any flat.
- `User.deleted_at` marks an admin soft-delete; it is the only soft-delete column in the schema.
- `Notification.target_user_id` supports `target_type = 'user'` (individual reminders) alongside `all` / `block` / `floor`.
- Child rows cascade on delete (attachments, comments, images, reactions, user_notifications); rows that reference `users` do not, so a user is never hard-deleted while their content remains.

### 5.2 D1 + Drizzle Configuration

The schema is a single TypeScript file, `src/db/schema.ts` — **15 tables** plus Drizzle
`relations()`. SQL migrations are generated from it, never hand-written:

```bash
# 1. edit src/db/schema.ts
pnpm --filter server d1:generate          # emits drizzle/NNNN_*.sql + meta/
pnpm --filter server d1:migrate:local     # apply to the local D1 simulation
pnpm --filter server d1:migrate:remote    # apply to production (CI does this pre-deploy)
```

```
packages/server/
├── drizzle.config.ts
├── drizzle/
│   ├── 0000_init.sql        # full baseline schema (the Sequelize history is not replayed)
│   └── meta/                # drizzle-kit journal + snapshots
└── scripts/
    ├── seed.mjs             # generates seed.sql — estate flats + discussion boards
    └── seed.sql             # generated; applied via `wrangler d1 execute`
```

Migrations do **not** run automatically on Worker start (there is no boot hook in a Worker);
applying them is an explicit step in the deploy workflow. Once a generated migration has been
applied anywhere, treat it as immutable — change `schema.ts` and generate a new one.

**Key conventions:**

- Primary keys are UUID v4 generated app-side (`crypto.randomUUID()` via the `uuidPk()` helper) — SQLite has no UUID type
- Timestamps are ISO-8601 **text**, set by `$defaultFn` / `$onUpdateFn`; `IncidentComment` is the lone table with no `updated_at`
- Column names stay snake_case (matching the old `underscored: true` output) so the client's response shape is unchanged
- Booleans are `integer({ mode: 'boolean' })`; `audit_logs.metadata` is `text({ mode: 'json' })`
- Enums are `text({ enum: [...] })` — enforced by Drizzle's types, not by the database
- Only `users.deleted_at` soft-deletes (admin user removal); everything else is a hard delete, with the audit log as the record
- Indexes on FKs and commonly filtered columns (status, type, board_id, user_id, target_block, target_floor)

**Seeded data:** flats (with registration passwords) and discussion boards. The admin
account is deliberately *not* seeded — it bootstraps from KV on first admin login.

### 5.3 Durable Object State (SessionStore)

`SessionStore` replaces Redis. It exposes a tiny Redis-shaped RPC surface — `hset` / `hget` /
`hgetall` / `hdel` for hash-like keys, `sset` / `sget` / `del` for scalars — with per-entry
TTLs swept by the DO `alarm()` handler.

Stubs are resolved by entity so that related writes land on one object and stay strongly
consistent (`src/http/session-store.ts`):

| Helper | DO id | Keys held | TTL |
|--------|-------|-----------|-----|
| `userStore(env, userId)` | `u:<userId>` | `session` → `{sessionId: sha256(refreshToken)}` | 7d per field |
| `userStore(env, userId)` | `u:<userId>` | `push` → `{endpointHash: subscriptionJson}` | none |
| `tokenStore(env, token)` | `t:<token>` | `reset` → `userId` | 1h |

Sharding per user is what makes refresh-token rotation race-free: every rotation for a given
user serializes through that user's single Durable Object.

> No server-side caching of report lists / unread counts / profiles exists — all reads go
> straight to D1. TanStack Query is the cache. Real-time SSE/WebSocket transport is not
> wired; clients poll.

---

## 6. Push Notification Architecture / 推送通知架構

```
┌──────────────┐   POST /api/notifications   ┌──────────────────┐
│  Mgmt Staff  │ ─────────────────────────→  │ Notification     │
│  (Client)    │                              │ Route Handler    │
└──────────────┘                              └────────┬─────────┘
                                                       │
                                                       ▼
                                              ┌──────────────────┐
                                              │ Notification     │
                                              │ Service          │
                                              │                  │
                                              │ 1. Save to D1    │
                                              │ 2. Resolve target│
                                              │    users         │
                                              │ 3. Create User   │
                                              │    Notifications │
                                              │ 4. Send Web Push │
                                              │    (fire & forget)│
                                              └────────┬─────────┘
                                                       │
                                          ┌────────────┴────────────┐
                                          ▼                         ▼
                                   ┌───────────┐            ┌──────────────┐
                                   │ D1        │            │ SessionStore │
                                   │(persist)  │            │  push subs   │
                                   └─────┬─────┘            └──────┬───────┘
                                         │                         ▼
                                         │                  ┌──────────────┐
                                         │                  │ Web Push     │
                                         ▼                  │ (VAPID)      │
                                   ┌──────────┐             └──────┬───────┘
                                   │ In-app   │                    ▼
                                   │ center   │             ┌──────────┐
                                   │ (polled) │             │ Browser  │
                                   └──────────┘             │ push     │
                                                            └──────────┘
```

**Target resolution logic:**
1. `target_type = all` → all active users
2. `target_type = block` → users whose flat.block matches `target_block`
3. `target_type = floor` → users whose flat.block + flat.floor match
4. `target_type = user` → the single user in `target_user_id` (individual reminders)

Each resolved user gets a `user_notifications` row carrying read state, then push fan-out
runs per device via `sendToUsers()`. Push is best-effort: a dead subscription is pruned from
the Durable Object, and every failure is swallowed so the originating request still succeeds.
If VAPID keys are unset, push endpoints return 503 and the in-app center still works.

**Auto-triggered fan-outs** (not user-composed): report status changes, auto-reopen on a
resident follow-up comment (→ mgmt/admin), and reopen escalation on the 3rd+ reopen
(→ oc_committee).

---

## 7. File Upload Architecture / 檔案上載架構

```
Client (multipart/form-data)
    │
    ▼
c.req.formData()  → File entries → .arrayBuffer()
    │
    ▼
http/upload.ts :: saveFile(env, bytes, entity)
    │
    ├── Size check: UPLOAD_MAX_SIZE (default 10MB per file)
    ├── Magic-byte sniff → JPEG / PNG / WebP / PDF only
    │     (the client-declared MIME type is ignored entirely)
    └── Reject on mismatch → HttpError 400
    │
    ▼
env.UPLOADS.put(key, bytes, { httpMetadata: { contentType } })   ← R2
    │
    ▼
Return { filePath, fileType, fileSize } → stored on the D1 row
```

**Object key convention:** `{entity}/{yyyy-mm}/{uuid}.{ext}`
- `entity`: `reports`, `posts`, `oc-documents`
- Served by `GET /uploads/*` (`http/routes/uploads.ts`), which streams the R2 body with the
  stored content type, the R2 etag, and `Cache-Control: public, max-age=31536000, immutable`

> **Security note.** `/uploads/*` is **unauthenticated**. Access control rests entirely on
> the key being an unguessable UUID — an upload URL is a capability. Anyone holding the URL
> can read the object, including after the owning report or post is deleted (R2 objects are
> not garbage-collected). Add an auth check plus a signed-URL scheme before treating uploads
> as confidential.

---

## 8. Security Architecture / 安全架構

### 8.1 Authentication & Authorization

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS (terminated by Cloudflare) |
| Security headers | Hono `secureHeaders()` on every route |
| Authentication | JWT via `jose` (access 15min + refresh 7d httpOnly cookie) |
| Authorization | `requireAuth()` + `requireRole(...)` middleware per route/group |
| Password hashing | WebCrypto PBKDF2-HMAC-SHA256, 100,000 iterations, 256-bit key, per-password random salt |
| Flat registration password | Same PBKDF2 scheme, compared on registration |
| Refresh / reset tokens at rest | SHA-256 only — plaintext is never stored |

Hash format is PHC-like: `pbkdf2-sha256$<iterations>$<saltB64>$<hashB64>`. The iteration
count travels with each hash, so raising it later is backward-compatible.

> **Why not Argon2id.** Argon2 on Workers requires a pre-compiled wasm import
> (`hash-wasm`'s inline `WebAssembly.compile` is blocked by the runtime). PBKDF2 was chosen
> because there were no legacy hashes to preserve — D1 started empty. **100,000 is a hard
> ceiling**: the production Workers runtime throws `NotSupportedError` above it, and
> `wrangler dev` does *not* enforce this, so the failure only appears after deploy.

### 8.2 Rate Limiting

**Not implemented on the Worker.** The retired Fastify stack enforced per-route limits
(auth 10/min, reports 20/min, posts 10/min, notifications 5/min, default 100/min); that layer
was not ported. Until it is, brute-force protection on `POST /api/auth/login` relies on
Cloudflare-level controls only. Restoring it means either a WAF rate-limiting rule in the
Cloudflare dashboard or a counter in a Durable Object / KV keyed by IP.

### 8.3 Input Validation

- **Zod** schemas via `@hono/zod-validator` on JSON bodies and query strings; multipart routes validate inline
- **`xss`** (`http/sanitize.ts`) sanitizes user-generated HTML/text before storage
- **Parameterized queries** via Drizzle — no raw SQL concatenation
- **File type validation** via magic bytes, not extension or declared MIME type
- **Account enumeration** guarded on `POST /auth/forgot-password` (always 200)

### 8.4 Audit Logging

All state-changing operations by management/admin roles are logged:

```json
{
  "user_id": "uuid",
  "action": "report.status.update",
  "entity_type": "IncidentReport",
  "entity_id": "uuid",
  "metadata": {
    "old_status": "pending",
    "new_status": "in_progress"
  },
  "created_at": "2026-03-28T10:00:00Z"
}
```

---

## 9. Deployment Architecture / 部署架構

> Full runbook: [deploy-cloudflare.md](deploy-cloudflare.md).

### 9.1 Development

```bash
pnpm --filter server d1:migrate:local   # apply migrations to the local D1 simulation
pnpm --filter server seed:local         # flats + discussion boards
pnpm --filter server cf:dev             # wrangler dev → http://localhost:8787
pnpm --filter client dev                # Vite dev server → http://localhost:5173
```

Local secrets live in `packages/server/.dev.vars` (gitignored; template in
`.dev.vars.example`). Set a local admin password with
`wrangler kv key put --binding=CONFIG "admin:password" "admin123" --local`.

Two caveats:

- `vite.config.ts` still proxies `/api` and `/uploads` to `http://localhost:3001` (the
  retired Fastify port). Point it at `8787` — or hit the Worker directly — when doing
  full-stack local work.
- `pnpm dev` at the repo root starts the **retired** Fastify server and expects Postgres +
  Redis. It is not the Cloudflare dev loop.

### 9.2 Production — CI / CD

`.github/workflows/deploy-cloudflare.yml` runs on push to `main` (server / client / lockfile
changes) or via `gh workflow run`. It:

1. builds the SPA (`packages/client/dist` — uploaded as the Worker's static assets)
2. regenerates binding types (`wrangler types`)
3. typechecks the Worker (`tsconfig.worker.json`)
4. applies pending D1 migrations (`wrangler d1 migrations apply --remote`)
5. `wrangler deploy`

Repo secrets required: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (Account-level edit
permissions for Workers Scripts, D1, Workers KV, Workers R2). The workflow never touches
runtime secrets.

```
        ┌────────────────── Cloudflare edge ──────────────────┐
        │                                                     │
Request ┤  /api/*, /uploads/*  ──→  Worker (Hono)  ──→ D1 / DO / R2 / KV
        │                                                     │
        │  everything else     ──→  Static assets → index.html (SPA)
        └─────────────────────────────────────────────────────┘
```

### 9.3 Configuration

Worker configuration lives in `packages/server/wrangler.jsonc`, not in a `.env` file.

**Public vars** (`vars` block — safe to commit):

```jsonc
"NODE_ENV": "production",
"API_PREFIX": "/api",
"VAPID_SUBJECT": "mailto:admin@email.yuenvoice.app",
"VAPID_PUBLIC_KEY": "<public half of the VAPID keypair>",
"UPLOAD_MAX_SIZE": "10485760",   // 10MB
"ADMIN_EMAIL": "admin@yuenvoice.app",
"ADMIN_NAME": "System Admin"
```

`CLIENT_ORIGIN` is optional — set it only when the SPA is served from a different origin,
which switches CORS on.

**Secrets** (`wrangler secret put`, or `.dev.vars` locally):

| Name | Purpose |
|------|---------|
| `JWT_ACCESS_SECRET` | Signs 15-minute access tokens |
| `JWT_REFRESH_SECRET` | Signs 7-day refresh tokens |
| `VAPID_PRIVATE_KEY` | Web Push signing (omit to disable push — endpoints return 503) |

**KV config** (`CONFIG` namespace) — `admin:password`, stored in plaintext and treated as a
secret. It is the source of truth for the admin login; rotate with
`wrangler kv key put --binding=CONFIG "admin:password" "<new>" --remote`, effective on the
next admin login. The root `.env` / `.env.example` files serve the retired Node stack only.

---

## 10. Monorepo Tooling / 開發工具

| Tool | Purpose |
|------|---------|
| **pnpm** | Package manager with workspace support |
| **TypeScript** | Type safety across client and server (Worker uses `tsconfig.worker.json`) |
| **Wrangler** | Worker dev server, D1 migrations, secrets, deploy |
| **Drizzle Kit** | Schema-first D1 migration generation |
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **Vitest** | Unit testing (client; server suite still targets the retired Fastify app) |
