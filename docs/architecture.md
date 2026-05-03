# YUENVOICE — Architecture Document

> Version: 1.1
> Last Updated: 2026-05-02
> Reference: [PRD.md](PRD.md)

---

## 1. System Overview / 系統概覽

YUENVOICE is a monorepo PWA with a clear client-server separation. The frontend is a Vite-built React SPA served as static assets; the backend is a Fastify REST API backed by PostgreSQL and Redis.

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
│                     Fastify API Server                      │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Auth     │  │  RBAC     │  │  Routes  │  │  Web Push │  │
│  │  (JWT)    │  │  Guard    │  │  Handlers│  │  Service  │  │
│  └─────┬────┘  └─────┬─────┘  └─────┬────┘  └─────┬─────┘  │
│        └──────────────┴──────────────┘              │        │
│                       ▼                             ▼        │
│  ┌──────────────────────────┐    ┌────────────────────────┐  │
│  │   Sequelize ORM Layer    │    │   Redis Client         │  │
│  │   Models / Migrations    │    │   Cache + Pub/Sub      │  │
│  └───────────┬──────────────┘    └───────────┬────────────┘  │
└──────────────┼───────────────────────────────┼──────────────┘
               ▼                               ▼
        ┌─────────────┐                 ┌─────────────┐
        │ PostgreSQL   │                │    Redis     │
        │ (Primary DB) │                │  (Cache/PubSub)│
        └─────────────┘                 └─────────────┘
```

---

## 2. Project Structure / 項目結構

```
yuenvoice/
├── docs/                        # Documentation
│   ├── PRD.md
│   ├── architecture.md
│   ├── development-plan.md
│   └── ui/                      # Sitemap + per-page wireframes
├── design-system/yuenvoice/     # MASTER.md + design tokens
├── .github/workflows/
│   └── build-images.yml         # CI: build & push GHCR images
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
│   └── server/                  # Backend (Fastify 5, ESM)
│       ├── src/
│       │   ├── index.ts         # Server entry
│       │   ├── app.ts           # Plugin & route registration (preserve order)
│       │   ├── config/index.ts
│       │   ├── plugins/
│       │   │   ├── auth.ts      # @fastify/jwt + cookie + authenticate decorator
│       │   │   ├── rbac.ts      # rbac(roles[]) preHandler factory
│       │   │   ├── redis.ts     # ioredis client plugin
│       │   │   └── upload.ts    # @fastify/multipart + magic-byte validation
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── reports.ts
│       │   │   ├── discussions.ts
│       │   │   ├── oc-documents.ts
│       │   │   ├── notifications.ts
│       │   │   ├── user-flats.ts        # multi-unit owner endpoints
│       │   │   └── admin.ts
│       │   ├── services/
│       │   │   ├── auth.service.ts
│       │   │   ├── report.service.ts        # incl. auto-reopen + mgmt notify
│       │   │   ├── discussion.service.ts
│       │   │   ├── oc-document.service.ts   # file + link-backed documents
│       │   │   ├── notification.service.ts  # send + resend + read tracking
│       │   │   ├── user-flat.service.ts     # multi-unit owner linking
│       │   │   └── push.service.ts
│       │   ├── models/          # 16 Sequelize models
│       │   │   ├── sequelize.ts # Sequelize instance (extracted, no circular)
│       │   │   ├── index.ts     # Associations + re-exports
│       │   │   ├── user.ts
│       │   │   ├── flat.ts
│       │   │   ├── user-flat.ts             # join table for multi-unit owners
│       │   │   ├── incident-report.ts
│       │   │   ├── incident-attachment.ts
│       │   │   ├── incident-comment.ts
│       │   │   ├── discussion-board.ts
│       │   │   ├── discussion-post.ts
│       │   │   ├── post-image.ts
│       │   │   ├── post-comment.ts
│       │   │   ├── post-reaction.ts
│       │   │   ├── oc-document.ts
│       │   │   ├── notification.ts
│       │   │   ├── user-notification.ts
│       │   │   └── audit-log.ts
│       │   ├── middleware/
│       │   │   └── rate-limit.ts
│       │   ├── utils/           # hash, pagination, audit, sanitize, env-validator, setup
│       │   └── __tests__/       # auth.test.ts, routes.test.ts, integration/smoke.test.ts
│       ├── migrations/          # 16 .cjs files, YYYYMMDDHHMMSS-name.cjs
│       ├── seeders/
│       ├── uploads/             # local file storage
│       ├── .sequelizerc
│       └── package.json
│
├── Dockerfile                   # Multi-stage (server + client targets)
├── docker-compose.yml           # Production stack
├── docker-compose.dev.yml       # Local dev stack
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
/forgot-password           → Forgot password (UI placeholder, server not yet wired)
/reset-password            → Reset password (UI placeholder, server not yet wired)
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
| `useAuthStore` | Current user, in-memory access token, isAuthenticated flag |
| `useThemeStore` | Light / dark / system theme, keyboard-shortcut toggle |

Server state (reports, posts, documents, notifications, flats, users) is managed via **TanStack Query** for caching, refetching, and optimistic updates. Service files (`src/services/*.ts`) export the Query hooks alongside the raw API calls. Notification unread count is read directly from the notifications query, not stored in Zustand.

### 3.3 API Client

A single Axios instance configured with:
- Base URL from environment config
- Request interceptor: attach access token from `useAuthStore`
- Response interceptor: on 401, attempt token refresh; if refresh fails, redirect to login

### 3.4 PWA Strategy

| Asset | Strategy | Reason |
|-------|----------|--------|
| App shell (HTML, JS, CSS) | Cache-first | Fast repeat loads |
| API responses | Network-first | Data freshness |
| Uploaded images | Cache-first | Reduce bandwidth |
| Fonts / icons | Cache-first | Rarely change |

**Offline behaviour:** Read-only access to cached data. Write actions (create report, post) are queued in IndexedDB and synced when back online.

---

## 4. Backend Architecture / 後端架構

### 4.1 Fastify Plugin Architecture

Fastify's plugin system is used to encapsulate cross-cutting concerns:

```
Fastify Instance
├── @fastify/cors          → CORS configuration
├── @fastify/helmet         → Security headers
├── @fastify/rate-limit     → Rate limiting
├── @fastify/multipart      → File upload handling
├── @fastify/jwt            → JWT sign/verify
├── custom: redis.ts        → Redis client (ioredis)
├── custom: auth.ts         → Request authentication decorator
├── custom: rbac.ts         → Role-based preHandler
└── Route plugins
    ├── auth routes         → /api/auth/*
    ├── report routes       → /api/reports/*
    ├── discussion routes   → /api/boards/*, /api/posts/*
    ├── oc-document routes  → /api/oc-documents/*
    ├── notification routes → /api/notifications/*, /api/push/*
    └── admin routes        → /api/admin/*
```

### 4.2 Request Lifecycle

```
Incoming Request
    │
    ▼
[ CORS / Helmet / Rate Limit ]      ← Global plugins
    │
    ▼
[ Route Match ]
    │
    ▼
[ Auth preHandler ]                  ← Verify JWT, attach user to request
    │
    ▼
[ RBAC preHandler ]                  ← Check user.role against route policy
    │
    ▼
[ Route Handler ]                    ← Call service layer
    │
    ▼
[ Service Layer ]                    ← Business logic
    │
    ├──→ Sequelize (PostgreSQL)      ← Data persistence
    ├──→ Redis                       ← Caching / pub-sub
    └──→ Web Push                    ← Push notification dispatch
    │
    ▼
[ Response Serialization ]           ← JSON response
```

### 4.3 Service Layer Pattern

Route handlers delegate to service modules. Services contain all business logic and are responsible for:

- Data validation beyond schema (e.g., checking flat password, target resolution)
- Sequelize queries and transactions
- Redis pub/sub for realtime fan-out
- Triggering web-push notifications (fire-and-forget — failures don't break the request)
- Writing audit log entries
- State-machine transitions (e.g., auto-reopen on resident follow-up)

```typescript
// Example: routes/reports.ts — note oc_committee is excluded (review-only)
fastify.post('/api/reports', {
  preHandler: [fastify.authenticate, fastify.rbac(['resident', 'mgmt_staff', 'admin'])]
}, async (request, reply) => {
  const report = await reportService.create(request.user.id, request.body);
  return reply.status(201).send(report);
});
```

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
- All FK relationships cascade on delete except `User → IncidentReport` (a user is never hard-deleted while reports remain).

### 5.2 Sequelize Configuration

Migrations are CommonJS (`.cjs`) and named `YYYYMMDDHHMMSS-description.cjs`. Umzug auto-runs pending migrations on server startup, so there is no manual `db:migrate` step in dev. Once a migration has been merged to `main`, never edit it — write a new one.

```
packages/server/
├── .sequelizerc                                    # Points to compiled paths
├── migrations/                                     # 16 files, chronological
│   ├── 20260328000001-create-flats.cjs
│   ├── 20260328000002-create-users.cjs
│   ├── 20260328000003-create-incident-reports.cjs
│   ├── 20260328000004-create-incident-attachments.cjs
│   ├── 20260328000005-create-incident-comments.cjs
│   ├── 20260328000006-create-discussion-boards.cjs
│   ├── 20260328000007-create-discussion-posts.cjs
│   ├── 20260328000008-create-post-images.cjs
│   ├── 20260328000009-create-post-comments.cjs
│   ├── 20260328000010-create-post-reactions.cjs
│   ├── 20260328000011-create-oc-documents.cjs
│   ├── 20260328000012-create-notifications.cjs
│   ├── 20260328000013-create-user-notifications.cjs
│   ├── 20260328000014-create-audit-logs.cjs
│   ├── 20260422210000-add-oc-document-links.cjs    # external_url + link_type
│   └── 20260422220000-create-user-flats.cjs        # multi-unit owner join
└── seeders/
    ├── seed-flats.cjs                              # Estate flats + reg passwords
    ├── seed-admin-user.cjs                         # Default admin
    └── seed-discussion-boards.cjs                  # Estate + per-block + per-floor
```

**Key conventions:**

- All primary keys are UUID v4 (`DataTypes.UUID`, `defaultValue: UUIDV4`)
- `underscored: true` on every model — TypeScript camelCase ↔ DB snake_case
- Timestamps via `created_at` / `updated_at`; `IncidentComment` is the lone exception (no `updated_at`)
- Soft delete not used — audit log tracks destructive actions instead
- Indexes on FKs and commonly filtered columns (status, type, board_id, target_block, target_floor)
- Sequelize instance is in `src/models/sequelize.ts` (extracted to break circular imports between models/index.ts and individual model files)

### 5.3 Redis Usage

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `session:refresh:<userId>` | Hash (`{sid: tokenHash}`) | 7d | Per-session refresh token hashes — invalidating one session won't kill the user's other devices |
| `push:sub:<userId>` | Hash (`{endpoint: subscriptionJson}`) | none | Web Push subscriptions (one user can have many devices) |
| `ratelimit:<route>:<ip>` | String | 1m | `@fastify/rate-limit` counter |

> Caching of report lists / unread counts / user profiles is **not** implemented — all reads go straight to PostgreSQL via Sequelize. TanStack Query handles the client-side cache. Add Redis caching only if a measured hot path requires it.

**Pub/Sub channels:**

| Channel | Publisher | Subscriber | Event |
|---------|-----------|------------|-------|
| `push:queue` | Notification service | Push worker (in-process) | Web Push dispatch fan-out |

> Real-time SSE/WebSocket transport is not yet wired — clients poll via TanStack Query for now.

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
                                              │ 1. Save to DB    │
                                              │ 2. Resolve target│
                                              │    users         │
                                              │ 3. Create User   │
                                              │    Notifications │
                                              │ 4. Publish Redis │
                                              │ 5. Send Web Push │
                                              └────────┬─────────┘
                                                       │
                                          ┌────────────┼────────────┐
                                          ▼            ▼            ▼
                                   ┌───────────┐ ┌─────────┐ ┌──────────┐
                                   │PostgreSQL │ │  Redis   │ │ Web Push │
                                   │(persist)  │ │(pub/sub) │ │ (VAPID)  │
                                   └───────────┘ └─────────┘ └──────────┘
                                                       │            │
                                                       ▼            ▼
                                                 ┌──────────┐ ┌──────────┐
                                                 │ In-app   │ │ Browser  │
                                                 │ realtime │ │ push     │
                                                 │ update   │ │ popup    │
                                                 └──────────┘ └──────────┘
```

**Target resolution logic:**
1. `target_type = all` → query all active users
2. `target_type = block` → query users whose flat.block matches `target_block`
3. `target_type = floor` → query users whose flat.block + flat.floor matches

---

## 7. File Upload Architecture / 檔案上載架構

```
Client (multipart/form-data)
    │
    ▼
@fastify/multipart
    │
    ▼
Upload Plugin (validates type, size)
    │
    ├── Max file size: 10MB per file
    ├── Allowed types: JPEG, PNG, WebP, PDF, DOC/DOCX
    └── Max files per request: 5
    │
    ▼
Storage Adapter (strategy pattern)
    │
    ├── Local: ./uploads/{entity}/{yyyy-mm}/{uuid}.{ext}
    └── S3: s3://{bucket}/{entity}/{yyyy-mm}/{uuid}.{ext}
    │
    ▼
Return file metadata (path, type, size) → saved to DB
```

**File path convention:** `{entity}/{yyyy-mm}/{uuid}.{ext}`
- `entity`: `reports`, `posts`, `oc-documents`
- Files are served via a static route `/uploads/*` (local) or pre-signed URLs (S3)

---

## 8. Security Architecture / 安全架構

### 8.1 Authentication & Authorization

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS (TLS 1.3) |
| Authentication | JWT (access 15min + refresh 7d httpOnly cookie) |
| Authorization | RBAC preHandler per route |
| Password hashing | Argon2id (OWASP recommended: memoryCost 19 MiB, timeCost 2, parallelism 1) |
| Flat registration password | Argon2id hashed, compared on registration |

### 8.2 Rate Limiting

| Route Group | Limit | Window |
|-------------|-------|--------|
| `POST /api/auth/*` | 10 requests | 1 minute |
| `POST /api/reports` | 20 requests | 1 minute |
| `POST /api/boards/*/posts` | 10 requests | 1 minute |
| `POST /api/notifications` | 5 requests | 1 minute |
| `POST /api/notifications/:id/resend` | 10 requests | 1 minute |
| All other routes | 100 requests | 1 minute |

### 8.3 Input Validation

- **Fastify JSON Schema** validation on all route inputs (body, params, query)
- **DOMPurify** for sanitizing user-generated HTML/text before storage
- **Parameterized queries** via Sequelize — no raw SQL concatenation
- **File type validation** via magic bytes, not just extension

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

### 9.1 Development

```
pnpm dev           # Runs both client (Vite dev server, port 5173)
                   # and server (tsx watch, port 3001) concurrently
                   # Vite proxies /api → Fastify
                   # Migrations auto-run on server startup via Umzug
```

`docker-compose.dev.yml` ships a Postgres + Redis pair for local dev so devs don't need to install them on the host.

### 9.2 Production — CI / CD

`.github/workflows/build-images.yml` builds and pushes two container images on every push to `main` and on `v*` tags:

- `ghcr.io/maxch3306/yuenvoice-server:<tag>`
- `ghcr.io/maxch3306/yuenvoice-client:<tag>`

Tags include the branch name, the short SHA, semver from `v*` tags, and `latest` (default branch only). Images are built from a single multi-stage `Dockerfile` with `target=server` and `target=client`. PRs build but don't push.

`docker-compose.yml` runs the production stack: nginx (reverse proxy + static client) → fastify (server image) → postgres + redis.

```
┌──────────────┐     ┌──────────────────────────────────┐
│   Nginx      │     │   yuenvoice-server (Fastify)     │
│   (Reverse   │────→│   ├── /api routes                │
│    Proxy)    │     │   └── /uploads/* static files    │
│              │     └────────────┬───────────┬─────────┘
│  ├── SSL     │                  │           │
│  ├── gzip    │     ┌──────────────────────────────────┐
│  └── static  │────→│   yuenvoice-client (nginx+dist)  │
│    client    │     └──────────────────────────────────┘
└──────────────┘                  │           │
                                  ▼           ▼
                           ┌──────────┐ ┌──────────┐
                           │PostgreSQL│ │  Redis   │
                           └──────────┘ └──────────┘
```

### 9.3 Environment Variables

The server fails fast on startup if any required variable is missing (`utils/env-validator.ts`). Defaults shown below are applied when the variable is unset — review every secret before deploying to production.

```env
# Server
NODE_ENV=production
PORT=3001
API_PREFIX=/api

# Database (required)
DATABASE_URL=postgresql://user:pass@localhost:5432/yuenvoice

# Redis (required)
REDIS_URL=redis://localhost:6379

# JWT (override in production!)
JWT_ACCESS_SECRET=dev-access-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production

# Web Push (VAPID — generate with `npx web-push generate-vapid-keys`)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@yuenvoice.app

# File Upload
UPLOAD_PROVIDER=local           # "local" or "s3"
UPLOAD_DIR=./uploads
UPLOAD_MAX_SIZE=10485760        # 10MB

# S3 (only when UPLOAD_PROVIDER=s3 — not yet implemented)
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# Default admin (created on first boot if no admin exists)
ADMIN_EMAIL=admin@yuenvoice.app
ADMIN_PASSWORD=admin123          # change immediately after first login
ADMIN_NAME=System Admin
```

---

## 10. Monorepo Tooling / 開發工具

| Tool | Purpose |
|------|---------|
| **pnpm** | Package manager with workspace support |
| **TypeScript** | Type safety across client and server |
| **ESLint** | Code linting (shared config) |
| **Prettier** | Code formatting |
| **Vitest** | Unit testing (client + server) |
| **Supertest** | API integration testing |
| **Husky + lint-staged** | Pre-commit hooks |
