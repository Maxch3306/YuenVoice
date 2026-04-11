# YUENVOICE — Architecture Document

> Version: 1.0
> Last Updated: 2026-03-28
> Reference: [PRD.md](PRD.md)

---

## 1. System Overview / 系統概覽

YUENVOICE is a monorepo PWA with a clear client-server separation. The frontend is a Vite-built React SPA served as static assets; the backend is a Fastify REST API backed by PostgreSQL and Redis.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (PWA)                         │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐  │
│  │  React 18  │  │ shadcn/ui │  │  Zustand  │  │  SW/Push │  │
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
│   └── architecture.md
├── packages/
│   ├── client/                  # Frontend (Vite + React)
│   │   ├── public/
│   │   │   ├── manifest.json    # PWA manifest
│   │   │   ├── sw.js            # Service Worker
│   │   │   └── icons/           # App icons (192, 512)
│   │   ├── src/
│   │   │   ├── main.tsx         # Entry point
│   │   │   ├── App.tsx          # Root component + router
│   │   │   ├── components/      # Shared UI components
│   │   │   │   └── ui/          # shadcn/ui components
│   │   │   ├── pages/           # Route-level page components
│   │   │   │   ├── auth/        # Login, Register
│   │   │   │   ├── reports/     # Incident reports
│   │   │   │   ├── discussion/  # Discussion boards
│   │   │   │   ├── oc/          # OC documents
│   │   │   │   ├── notifications/ # Notification center
│   │   │   │   └── admin/       # Admin dashboard
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   ├── stores/          # Zustand state stores
│   │   │   ├── services/        # API client functions
│   │   │   ├── lib/             # Utilities, constants
│   │   │   └── types/           # Shared TypeScript types
│   │   ├── index.html
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   │
│   └── server/                  # Backend (Fastify)
│       ├── src/
│       │   ├── index.ts         # Server entry, Fastify init
│       │   ├── app.ts           # Plugin registration, route mounting
│       │   ├── config/          # Environment & app config
│       │   │   └── index.ts
│       │   ├── plugins/         # Fastify plugins
│       │   │   ├── auth.ts      # JWT verification decorator
│       │   │   ├── rbac.ts      # Role-based access guard
│       │   │   ├── redis.ts     # Redis client plugin
│       │   │   └── upload.ts    # File upload (multipart)
│       │   ├── routes/          # Route modules
│       │   │   ├── auth.ts
│       │   │   ├── reports.ts
│       │   │   ├── discussions.ts
│       │   │   ├── oc-documents.ts
│       │   │   ├── notifications.ts
│       │   │   └── admin.ts
│       │   ├── services/        # Business logic layer
│       │   │   ├── auth.service.ts
│       │   │   ├── report.service.ts
│       │   │   ├── discussion.service.ts
│       │   │   ├── oc-document.service.ts
│       │   │   ├── notification.service.ts
│       │   │   └── push.service.ts
│       │   ├── models/          # Sequelize model definitions
│       │   │   ├── index.ts     # Model registration & associations
│       │   │   ├── user.ts
│       │   │   ├── flat.ts
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
│       │   ├── middleware/      # Request-level middleware
│       │   │   └── rate-limit.ts
│       │   └── utils/           # Helpers (hashing, pagination, etc.)
│       ├── migrations/          # Sequelize migration files
│       ├── seeders/             # Sequelize seed files
│       ├── uploads/             # Uploaded file storage (dev)
│       ├── .sequelizerc         # Sequelize CLI config
│       ├── tsconfig.json
│       └── package.json
│
├── package.json                 # Root workspace config
├── pnpm-workspace.yaml          # pnpm workspace definition
├── .env.example                 # Environment variable template
├── .gitignore
└── LICENSE
```

---

## 3. Frontend Architecture / 前端架構

### 3.1 Routing

React Router v6 with layout-based routing. Protected routes redirect unauthenticated users to `/login`.

```
/                          → Redirect to /reports (default home)
/login                     → Login page
/register                  → Registration (flat password flow)
/reports                   → My incident reports list
/reports/new               → Create new report
/reports/:id               → Report detail + status timeline
/discussion                → Board list
/discussion/:boardId       → Posts in board
/discussion/:boardId/new   → Create new post
/discussion/post/:postId   → Post detail + comments
/oc                        → OC documents list
/oc/:id                    → Document viewer (PDF)
/notifications             → Notification center
/admin                     → Admin dashboard (admin only)
/admin/users               → User management
/admin/flats               → Flat & password management
/admin/audit-logs          → Audit log viewer
```

### 3.2 State Management

**Zustand** for lightweight client state. No global store — each domain has its own store.

| Store | Responsibility |
|-------|---------------|
| `useAuthStore` | Current user, tokens, login/logout actions |
| `useNotificationStore` | Unread count, notification list, mark-as-read |

Server state (reports, posts, documents) is managed via **React Query (TanStack Query)** for caching, refetching, and optimistic updates.

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
- Data validation beyond schema (e.g., checking flat password)
- Sequelize queries and transactions
- Redis cache invalidation
- Triggering push notifications
- Writing audit log entries

```typescript
// Example: routes/reports.ts
fastify.post('/api/reports', {
  preHandler: [fastify.authenticate, fastify.rbac(['resident', 'oc_committee', 'mgmt_staff', 'admin'])]
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
┌──────────┐       ┌───────────────────┐       ┌─────────────────┐
│   Flat   │1────N│      User          │1────N │ IncidentReport   │
│          │       │                   │       │                  │
│ block    │       │ email             │       │ type             │
│ floor    │       │ name              │       │ status           │
│ unit_no  │       │ role              │       │ priority         │
│ reg_pwd  │       │ flat_id (FK)      │       │ reporter_id (FK) │
└──────────┘       └─────────┬─────────┘       └────────┬─────────┘
                             │                          │
                             │                    ┌─────┴──────┐
                             │                    │            │
                      ┌──────┴───────┐    ┌──────┴─────┐ ┌────┴──────────┐
                      │DiscussionPost│    │ Incident   │ │ Incident      │
                      │              │    │ Comment    │ │ Attachment    │
                      │ board_id(FK) │    └────────────┘ └───────────────┘
                      │ author_id(FK)│
                      │ is_anonymous │
                      └──────┬───────┘
                             │
                   ┌─────────┼──────────┐
                   │         │          │
             ┌─────┴────┐ ┌──┴──────┐ ┌─┴───────────┐
             │PostImage  │ │Post     │ │Post         │
             │           │ │Comment  │ │Reaction     │
             └──────────┘ └─────────┘ └─────────────┘

┌──────────────┐     ┌───────────────────┐
│ OcDocument   │     │   Notification     │1────N┌──────────────────┐
│              │     │                   │      │ UserNotification  │
│ publisher_id │     │ sender_id         │      │                  │
│ type         │     │ target_type       │      │ user_id (FK)     │
│ file_path    │     │ target_block      │      │ is_read          │
└──────────────┘     └───────────────────┘      └──────────────────┘

┌──────────────┐
│  AuditLog    │
│              │
│ user_id (FK) │
│ action       │
│ entity_type  │
│ metadata     │
└──────────────┘
```

### 5.2 Sequelize Configuration

```
packages/server/
├── .sequelizerc               # Points to compiled paths
├── migrations/
│   ├── 001-create-flats.js
│   ├── 002-create-users.js
│   ├── 003-create-incident-reports.js
│   ├── 004-create-incident-attachments.js
│   ├── 005-create-incident-comments.js
│   ├── 006-create-discussion-boards.js
│   ├── 007-create-discussion-posts.js
│   ├── 008-create-post-images.js
│   ├── 009-create-post-comments.js
│   ├── 010-create-post-reactions.js
│   ├── 011-create-oc-documents.js
│   ├── 012-create-notifications.js
│   ├── 013-create-user-notifications.js
│   └── 014-create-audit-logs.js
└── seeders/
    ├── 001-seed-flats.js           # Estate flats with registration passwords
    ├── 002-seed-admin-user.js      # Default system admin account
    └── 003-seed-discussion-boards.js # Default boards (estate-wide + per-block)
```

**Key conventions:**
- All primary keys are UUID v4 (`DataTypes.UUID`, `defaultValue: UUIDV4`)
- Timestamps via `createdAt` / `updatedAt` (Sequelize default)
- Soft delete not used — audit log tracks destructive actions instead
- Indexes on foreign keys and commonly filtered columns (status, type, board_id)

### 5.3 Redis Usage

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `session:refresh:<userId>` | String | 7d | Refresh token for invalidation |
| `user:<userId>` | Hash | 15m | Cached user profile |
| `reports:list:<filters_hash>` | String | 5m | Cached report list queries |
| `notifications:unread:<userId>` | String | 5m | Unread notification count |
| `ratelimit:<ip>:<route>` | String | 1m | Rate limit counter |

**Pub/Sub channels:**

| Channel | Publisher | Subscriber | Event |
|---------|-----------|------------|-------|
| `notify:user:<userId>` | Notification service | Client (SSE/polling) | New notification |
| `report:status:<reportId>` | Report service | Client (SSE/polling) | Status change |

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
| Password hashing | bcrypt, cost factor 12 |
| Flat registration password | bcrypt hashed, compared on registration |

### 8.2 Rate Limiting

| Route Group | Limit | Window |
|-------------|-------|--------|
| `POST /api/auth/*` | 10 requests | 1 minute |
| `POST /api/reports` | 20 requests | 1 minute |
| `POST /api/boards/*/posts` | 10 requests | 1 minute |
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
pnpm dev           # Runs both client (Vite dev server) and server (tsx watch)
                   # Vite proxies /api → Fastify on port 3001
```

### 9.2 Production

```
┌──────────────┐     ┌──────────────────────────────┐
│   Nginx      │     │       Application Server      │
│   (Reverse   │────→│                               │
│    Proxy)    │     │  Fastify (Node.js)             │
│              │     │  ├── Serves /api routes         │
│  ├── SSL     │     │  └── Serves static client build │
│  ├── gzip    │     │       from packages/client/dist │
│  └── cache   │     └────────────┬─────────┬─────────┘
└──────────────┘                  │         │
                                  ▼         ▼
                           ┌──────────┐ ┌───────┐
                           │PostgreSQL│ │ Redis  │
                           └──────────┘ └───────┘
```

### 9.3 Environment Variables

```env
# Server
NODE_ENV=production
PORT=3001
API_PREFIX=/api

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/yuenvoice

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=<random-256-bit>
JWT_REFRESH_SECRET=<random-256-bit>

# Web Push (VAPID)
VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated>
VAPID_SUBJECT=mailto:admin@yuenvoice.app

# File Upload
UPLOAD_PROVIDER=local           # or "s3"
UPLOAD_DIR=./uploads
UPLOAD_MAX_SIZE=10485760        # 10MB

# S3 (optional)
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
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
