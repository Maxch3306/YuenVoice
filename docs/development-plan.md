# YUENVOICE — Development Plan

> Version: 1.0
> Last Updated: 2026-03-28
> Reference: [PRD.md](PRD.md) | [architecture.md](architecture.md)

---

## Design Principles / 設計原則

This plan is structured for **maximum parallel execution**. Each wave contains tasks that:
- Touch **completely separate files and directories**
- Have **no runtime or import dependencies** on sibling tasks in the same wave
- Can be assigned to **independent agents** working simultaneously

Agents merge results at wave boundaries before the next wave begins.

---

## Wave 0 — Project Scaffolding / 項目初始化

> **Sequential.** Must complete before all other waves. Sets up the monorepo skeleton that all agents will work within.

### Task 0.1: Monorepo Bootstrap

**Agent: Scaffold**

| Item | Detail |
|------|--------|
| Files | Root `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.env.example`, `tsconfig.base.json`, `.prettierrc`, `.eslintrc.cjs` |
| Action | `pnpm init`, configure workspaces for `packages/client` and `packages/server` |

**Deliverables:**
- [ ] Root workspace config with scripts: `dev`, `build`, `lint`, `format`
- [ ] Shared TypeScript base config (`tsconfig.base.json`)
- [ ] ESLint + Prettier config (shared)
- [ ] `.gitignore` covering `node_modules`, `dist`, `.env`, `uploads/`
- [ ] `.env.example` with all env vars from architecture doc

### Task 0.2: Client Scaffold

**Agent: Scaffold (continued)**

| Item | Detail |
|------|--------|
| Files | Everything under `packages/client/` |
| Action | `pnpm create vite`, install React 18, TypeScript, Tailwind, shadcn/ui init |

**Deliverables:**
- [ ] Vite + React + TypeScript project
- [ ] Tailwind CSS configured
- [ ] shadcn/ui initialized with base theme
- [ ] Empty directory structure: `pages/`, `components/ui/`, `hooks/`, `stores/`, `services/`, `lib/`, `types/`
- [ ] `vite.config.ts` with `/api` proxy to `localhost:3001`
- [ ] PWA manifest (`public/manifest.json`) and placeholder icons

### Task 0.3: Server Scaffold

**Agent: Scaffold (continued)**

| Item | Detail |
|------|--------|
| Files | Everything under `packages/server/` |
| Action | Init package, install Fastify, Sequelize, dependencies |

**Deliverables:**
- [ ] Fastify server entry (`src/index.ts` + `src/app.ts`)
- [ ] `src/config/index.ts` reading env vars
- [ ] Sequelize instance initialized (`src/models/index.ts` — connection only, no models yet)
- [ ] `.sequelizerc` pointing to migrations/seeders/models
- [ ] Empty directory structure: `routes/`, `services/`, `models/`, `plugins/`, `middleware/`, `utils/`
- [ ] `migrations/`, `seeders/`, `uploads/` directories
- [ ] Health check route: `GET /api/health` → `{ status: "ok" }`
- [ ] Dev script with `tsx watch`

---

## Wave 1 — Foundation Layer / 基礎層

> **3 agents in parallel.** No file overlap. Each agent works in isolated directories.

```
Wave 1 Agents (parallel)
├── Agent A: Database Models + Migrations    → packages/server/src/models/, migrations/, seeders/
├── Agent B: Server Core Plugins             → packages/server/src/plugins/, middleware/, utils/
└── Agent C: Client Core Shell               → packages/client/src/ (App, router, layouts, stores, api client)
```

### Task 1A: Database Models + Migrations + Seeds

**Agent A — Files: `packages/server/src/models/`, `migrations/`, `seeders/`**

| Item | Detail |
|------|--------|
| Depends on | Wave 0 (Sequelize connection in `models/index.ts`) |
| Touches | Only model definitions, migration files, seed files |
| Does NOT touch | Routes, services, plugins, client |

**Deliverables:**
- [ ] 14 Sequelize model definitions (all entities from PRD Section 6)
  - `flat.ts`, `user.ts`, `incident-report.ts`, `incident-attachment.ts`, `incident-comment.ts`
  - `discussion-board.ts`, `discussion-post.ts`, `post-image.ts`, `post-comment.ts`, `post-reaction.ts`
  - `oc-document.ts`, `notification.ts`, `user-notification.ts`, `audit-log.ts`
- [ ] `models/index.ts` updated with all model registrations and associations
- [ ] 14 migration files (`001-create-flats.js` through `014-create-audit-logs.js`)
- [ ] 3 seed files:
  - `001-seed-flats.js` — sample estate (3 blocks × 20 floors × 8 units, with hashed registration passwords)
  - `002-seed-admin-user.js` — default admin account
  - `003-seed-discussion-boards.js` — estate-wide board + per-block boards
- [ ] All UUIDs, indexes on FKs, enum constraints

---

### Task 1B: Server Core Plugins

**Agent B — Files: `packages/server/src/plugins/`, `middleware/`, `utils/`**

| Item | Detail |
|------|--------|
| Depends on | Wave 0 (Fastify app in `app.ts`) |
| Touches | Only plugins, middleware, utils |
| Does NOT touch | Routes, services, models (beyond importing types), client |

**Deliverables:**
- [ ] `plugins/auth.ts` — `@fastify/jwt` setup, `fastify.authenticate` decorator (verifies access token, attaches `request.user`)
- [ ] `plugins/rbac.ts` — `fastify.rbac(roles[])` preHandler factory, checks `request.user.role`
- [ ] `plugins/redis.ts` — ioredis client plugin, exposes `fastify.redis`
- [ ] `plugins/upload.ts` — `@fastify/multipart` config, file validation (type, size), storage adapter (local + S3 interface)
- [ ] `middleware/rate-limit.ts` — `@fastify/rate-limit` config per route group
- [ ] `utils/hash.ts` — bcrypt hash/compare helpers
- [ ] `utils/pagination.ts` — standard pagination params parser + Sequelize query builder
- [ ] `utils/audit.ts` — `logAudit(userId, action, entityType, entityId, metadata)` helper
- [ ] Register all plugins in `app.ts` (CORS, Helmet, rate-limit, JWT, Redis, upload, auth, rbac)

---

### Task 1C: Client Core Shell

**Agent C — Files: `packages/client/src/` (App.tsx, router, layouts, stores, services, types)**

| Item | Detail |
|------|--------|
| Depends on | Wave 0 (Vite project) |
| Touches | App.tsx, router config, layout components, stores, API client, types |
| Does NOT touch | Page components (pages/*), server code |

**Deliverables:**
- [ ] `types/index.ts` — TypeScript interfaces for all entities (User, Flat, Report, Post, etc.) and API response types
- [ ] `lib/api.ts` — Axios instance with base URL, auth interceptor (attach token), 401 refresh interceptor
- [ ] `stores/auth-store.ts` — Zustand store: user, accessToken, login(), logout(), refreshToken()
- [ ] `stores/notification-store.ts` — Zustand store: unreadCount, notifications[], markAsRead()
- [ ] `lib/query-client.ts` — TanStack Query client configuration
- [ ] `components/layouts/MainLayout.tsx` — App shell with sidebar/bottom nav, header, notification bell
- [ ] `components/layouts/AuthLayout.tsx` — Minimal layout for login/register pages
- [ ] `components/layouts/AdminLayout.tsx` — Admin-specific layout with side menu
- [ ] `App.tsx` — React Router v6 setup with all routes (from architecture doc Section 3.1)
  - Protected route wrapper (redirects to `/login` if not authenticated)
  - Role-based route guard (admin routes)
- [ ] `main.tsx` — QueryClientProvider + RouterProvider + app mount
- [ ] Placeholder page components (empty files returning `<div>Page Name</div>`) for all routes so the router compiles

---

## Wave 2 — Feature Modules (Backend) / 功能模組（後端）

> **4 agents in parallel.** Each agent owns one feature domain's route + service files. No overlap.

```
Wave 2 Agents (parallel)
├── Agent D: Auth Routes + Service          → routes/auth.ts, services/auth.service.ts
├── Agent E: Reports Routes + Service       → routes/reports.ts, services/report.service.ts
├── Agent F: Discussion Routes + Service    → routes/discussions.ts, services/discussion.service.ts
└── Agent G: OC Docs + Notifications + Admin → routes/oc-documents.ts, notifications.ts, admin.ts + services/*
```

### Task 2D: Auth Module

**Agent D — Files: `routes/auth.ts`, `services/auth.service.ts`**

| Depends on | Wave 1A (User, Flat models), Wave 1B (auth plugin, hash utils) |
|------------|--------------------------------------------------------------|

**Deliverables:**
- [ ] `POST /api/auth/register` — validate flat password → create user → return JWT pair
- [ ] `POST /api/auth/login` — verify email + password → return JWT pair
- [ ] `POST /api/auth/refresh` — verify refresh token → rotate pair
- [ ] `POST /api/auth/logout` — invalidate refresh token in Redis
- [ ] `POST /api/auth/forgot-password` — generate reset token (stub email/SMS)
- [ ] `POST /api/auth/reset-password` — validate token → update password
- [ ] JSON Schema validation on all request bodies
- [ ] Rate limiting: 10 req/min on auth routes

---

### Task 2E: Incident Reports Module

**Agent E — Files: `routes/reports.ts`, `services/report.service.ts`**

| Depends on | Wave 1A (Report, Attachment, Comment models), Wave 1B (plugins) |
|------------|----------------------------------------------------------------|

**Deliverables:**
- [ ] `POST /api/reports` — create report (resident+)
- [ ] `GET /api/reports` — list own reports (resident) or all (mgmt/admin), with filters (status, type, date) + pagination
- [ ] `GET /api/reports/:id` — report detail with attachments + comments
- [ ] `PATCH /api/reports/:id/status` — update status (mgmt/admin), triggers notification
- [ ] `POST /api/reports/:id/comments` — add comment (supports `is_internal` flag for mgmt)
- [ ] `POST /api/reports/:id/attachments` — upload files (max 5, 10MB each)
- [ ] Audit logging for status changes
- [ ] JSON Schema validation, RBAC on each endpoint

---

### Task 2F: Discussion Module

**Agent F — Files: `routes/discussions.ts`, `services/discussion.service.ts`**

| Depends on | Wave 1A (Board, Post, PostImage, PostComment, PostReaction models), Wave 1B (plugins) |
|------------|--------------------------------------------------------------------------------------|

**Deliverables:**
- [ ] `GET /api/boards` — list boards (filtered by user's block access)
- [ ] `GET /api/boards/:id/posts` — list posts with pagination, sorted reverse-chron
- [ ] `POST /api/boards/:id/posts` — create post with optional photos (up to 5) + anonymous flag
- [ ] `GET /api/posts/:id` — post detail with images, comments, reactions
- [ ] `POST /api/posts/:id/comments` — add comment (supports anonymous)
- [ ] `POST /api/posts/:id/reactions` — toggle like/reaction
- [ ] `POST /api/posts/:id/report` — flag inappropriate content
- [ ] `PATCH /api/posts/:id/moderate` — hide/pin/delete (mgmt/admin)
- [ ] JSON Schema validation, RBAC on each endpoint

---

### Task 2G: OC Documents + Notifications + Admin

**Agent G — Files: `routes/oc-documents.ts`, `routes/notifications.ts`, `routes/admin.ts`, `services/oc-document.service.ts`, `services/notification.service.ts`, `services/push.service.ts`**

| Depends on | Wave 1A (OcDocument, Notification, UserNotification models), Wave 1B (plugins) |
|------------|-------------------------------------------------------------------------------|

**Deliverables:**

**OC Documents:**
- [ ] `POST /api/oc-documents` — upload document (OC committee / admin)
- [ ] `GET /api/oc-documents` — list documents (filtered by year, type) + pagination
- [ ] `GET /api/oc-documents/:id` — document detail
- [ ] `DELETE /api/oc-documents/:id` — remove (OC committee / admin)

**Notifications:**
- [ ] `POST /api/notifications` — send targeted notification (mgmt/admin), resolve target users, create UserNotification rows, dispatch Web Push
- [ ] `GET /api/notifications` — list current user's notifications (paginated, read/unread)
- [ ] `PATCH /api/notifications/:id/read` — mark as read
- [ ] `POST /api/push/subscribe` — register browser push subscription (VAPID)
- [ ] `DELETE /api/push/subscribe` — unregister push subscription
- [ ] `services/push.service.ts` — Web Push dispatch via `web-push` library

**Admin:**
- [ ] `GET /api/admin/users` — list all users (paginated, filterable)
- [ ] `PATCH /api/admin/users/:id/role` — update user role
- [ ] `PATCH /api/admin/users/:id/status` — activate/deactivate user
- [ ] `GET /api/admin/flats` — list all flats with registration status
- [ ] `POST /api/admin/flats/:id/reset-password` — regenerate flat registration password
- [ ] `GET /api/admin/audit-logs` — view audit logs (paginated, filterable)
- [ ] RBAC: admin-only on all admin routes, oc_committee on OC doc write routes

---

## Wave 3 — Feature Modules (Frontend) / 功能模組（前端）

> **4 agents in parallel.** Each agent owns isolated page directories and their API service files. No file overlap.

```
Wave 3 Agents (parallel)
├── Agent H: Auth Pages                → pages/auth/, services/auth.ts
├── Agent I: Reports Pages             → pages/reports/, services/reports.ts
├── Agent J: Discussion Pages          → pages/discussion/, services/discussions.ts
└── Agent K: OC + Notifications + Admin → pages/oc/, pages/notifications/, pages/admin/, services/oc.ts, notifications.ts, admin.ts
```

### Task 3H: Auth Pages

**Agent H — Files: `pages/auth/`, `services/auth.ts`**

| Depends on | Wave 1C (auth store, API client, AuthLayout, types) |
|------------|-----------------------------------------------------|

**Deliverables:**
- [ ] `services/auth.ts` — API functions: `register()`, `login()`, `refresh()`, `logout()`, `forgotPassword()`, `resetPassword()`
- [ ] `pages/auth/LoginPage.tsx` — email + password form, error handling, redirect to `/reports` on success
- [ ] `pages/auth/RegisterPage.tsx` — multi-step form:
  1. Select block + flat number
  2. Enter flat registration password
  3. Set up account (name, email, phone, password)
- [ ] `pages/auth/ForgotPasswordPage.tsx` — email input → request reset
- [ ] `pages/auth/ResetPasswordPage.tsx` — new password form with token validation
- [ ] Form validation with proper error messages (bilingual)

---

### Task 3I: Reports Pages

**Agent I — Files: `pages/reports/`, `services/reports.ts`**

| Depends on | Wave 1C (MainLayout, API client, types, query client) |
|------------|-------------------------------------------------------|

**Deliverables:**
- [ ] `services/reports.ts` — API functions: `createReport()`, `getReports()`, `getReport()`, `updateStatus()`, `addComment()`, `uploadAttachment()`
- [ ] `pages/reports/ReportListPage.tsx` — list with filter tabs (all / pending / in progress / completed), type filter, search
- [ ] `pages/reports/CreateReportPage.tsx` — form: title, type (dropdown), description, location selectors (block/floor/area), photo upload (drag & drop or tap)
- [ ] `pages/reports/ReportDetailPage.tsx` — status timeline, attachments gallery, comment thread, status update buttons (for mgmt role)
- [ ] TanStack Query hooks for data fetching + caching
- [ ] Empty states, loading skeletons

---

### Task 3J: Discussion Pages

**Agent J — Files: `pages/discussion/`, `services/discussions.ts`**

| Depends on | Wave 1C (MainLayout, API client, types, query client) |
|------------|-------------------------------------------------------|

**Deliverables:**
- [ ] `services/discussions.ts` — API functions: `getBoards()`, `getPosts()`, `createPost()`, `getPost()`, `addComment()`, `toggleReaction()`, `flagPost()`, `moderatePost()`
- [ ] `pages/discussion/BoardListPage.tsx` — list of boards (estate-wide, block-specific), board card with latest post preview
- [ ] `pages/discussion/PostListPage.tsx` — posts in a board, reverse-chron, with pinned posts at top, post card (title, excerpt, author/anonymous, image thumbnails, reaction count, comment count)
- [ ] `pages/discussion/CreatePostPage.tsx` — form: title, body (rich text or plain), photo upload (multi), anonymous toggle
- [ ] `pages/discussion/PostDetailPage.tsx` — full post with images (lightbox), comment thread, like button, flag button, moderation controls (for mgmt role: pin/hide/delete)
- [ ] TanStack Query hooks, empty states, loading skeletons

---

### Task 3K: OC + Notifications + Admin Pages

**Agent K — Files: `pages/oc/`, `pages/notifications/`, `pages/admin/`, `services/oc.ts`, `services/notifications.ts`, `services/admin.ts`**

| Depends on | Wave 1C (MainLayout, AdminLayout, API client, types, notification store) |
|------------|-------------------------------------------------------------------------|

**Deliverables:**

**OC Documents:**
- [ ] `services/oc.ts` — `getDocuments()`, `getDocument()`, `uploadDocument()`, `deleteDocument()`
- [ ] `pages/oc/DocumentListPage.tsx` — documents grouped by year, filterable by type, card with title + type badge + date
- [ ] `pages/oc/DocumentViewPage.tsx` — in-app PDF viewer (react-pdf or iframe), download button, document metadata

**Notifications:**
- [ ] `services/notifications.ts` — `getNotifications()`, `markAsRead()`, `subscribePush()`, `unsubscribePush()`
- [ ] `pages/notifications/NotificationCenterPage.tsx` — notification list (read/unread styling), category badges (urgent/general/event), mark-as-read on click, pull-to-refresh
- [ ] Notification bell component (badge with unread count) — placed in MainLayout header

**Admin:**
- [ ] `services/admin.ts` — `getUsers()`, `updateRole()`, `updateStatus()`, `getFlats()`, `resetFlatPassword()`, `getAuditLogs()`
- [ ] `pages/admin/DashboardPage.tsx` — stats overview (total users, open reports, recent activity)
- [ ] `pages/admin/UserManagementPage.tsx` — user table with role dropdown, activate/deactivate toggle, search
- [ ] `pages/admin/FlatManagementPage.tsx` — flat table with block/floor/unit, registration status, reset password button (with confirmation dialog)
- [ ] `pages/admin/AuditLogPage.tsx` — audit log table with filters (user, action, date range), expandable metadata JSON

---

## Wave 4 — Integration & PWA / 整合及 PWA

> **2 agents in parallel.** One handles backend integration wiring, the other handles PWA + frontend polish.

```
Wave 4 Agents (parallel)
├── Agent L: Backend Integration     → Route registration in app.ts, auto-notification triggers, Redis pub/sub wiring
└── Agent M: PWA + Frontend Polish   → Service Worker, offline support, push subscription UI, responsive polish
```

### Task 4L: Backend Integration Wiring

**Agent L — Files: `app.ts` (route registration), cross-service notification triggers**

**Deliverables:**
- [ ] Register all route plugins in `app.ts` in correct order
- [ ] Wire auto-triggered notifications:
  - Report status change → push notification to reporter
  - New OC document → push notification to all residents
  - Flagged post threshold → notification to mgmt staff
- [ ] Redis pub/sub integration for real-time events
- [ ] Serve static uploads via `@fastify/static` at `/uploads/*`
- [ ] End-to-end API smoke test (Supertest): auth → create report → update status → verify notification

---

### Task 4M: PWA + Frontend Polish

**Agent M — Files: `public/sw.js`, `public/manifest.json`, push subscription logic, responsive CSS**

**Deliverables:**
- [ ] Service Worker with Workbox:
  - Cache-first for app shell (HTML, JS, CSS)
  - Network-first for API responses
  - Cache-first for uploaded images
- [ ] Push notification permission flow (prompt after first login)
- [ ] Push event handler in Service Worker (display notification, click → open relevant page)
- [ ] Offline fallback page
- [ ] Responsive polish: mobile-first, test at 375px / 768px / 1280px
- [ ] App install prompt (beforeinstallprompt event)
- [ ] Loading states, error boundaries, toast notifications (sonner via shadcn)

---

## Wave 5 — Testing & Hardening / 測試及安全強化

> **2 agents in parallel.** One writes tests, the other handles security.

```
Wave 5 Agents (parallel)
├── Agent N: Testing       → __tests__/ directories in both client and server
└── Agent O: Security      → Security headers, input sanitization, rate limit tuning
```

### Task 5N: Testing

**Agent N**

**Deliverables:**
- [ ] Server unit tests (Vitest + Supertest):
  - Auth flow: register, login, refresh, invalid flat password rejection
  - Report CRUD + status transitions
  - Discussion CRUD + anonymous posting
  - OC document upload + access control
  - Notification targeting (all / block / floor)
  - RBAC: verify unauthorized access returns 403
- [ ] Client unit tests (Vitest + Testing Library):
  - Auth forms: validation, submission
  - Report list: filter, empty state
  - Post creation: photo upload, anonymous toggle
- [ ] `pnpm test` script in root runs both

---

### Task 5O: Security Hardening

**Agent O**

**Deliverables:**
- [ ] Input sanitization with DOMPurify on all user-generated text fields (report description, post body, comments)
- [ ] File upload validation via magic bytes (not just extension)
- [ ] Rate limit tuning per route group (per architecture doc Section 8.2)
- [ ] CSRF protection for cookie-based refresh token
- [ ] Security headers audit (`@fastify/helmet` config)
- [ ] SQL injection protection verification (all queries via Sequelize, no raw SQL)
- [ ] `.env` validation on server startup (fail fast on missing required vars)

---

## Dependency Graph / 依賴關係圖

```
Wave 0: Scaffold
  │
  ├──────────────────────┬──────────────────────┐
  ▼                      ▼                      ▼
Wave 1A: DB Models    Wave 1B: Plugins       Wave 1C: Client Shell
  │                      │                      │
  ├──────────┬───────────┤                      │
  ▼          ▼           ▼                      ▼
Wave 2D    Wave 2E    Wave 2F    Wave 2G     Wave 3H  Wave 3I  Wave 3J  Wave 3K
(Auth)     (Reports)  (Discuss)  (OC+Notif   (Auth    (Report  (Discuss (OC+Notif
                                 +Admin)      Pages)   Pages)   Pages)   +Admin)
  │          │           │          │           │        │        │        │
  └──────────┴───────────┴──────────┘           └────────┴────────┴────────┘
              │                                            │
              ▼                                            ▼
         Wave 4L: Backend Integration              Wave 4M: PWA + Polish
              │                                            │
              └──────────────┬─────────────────────────────┘
                             ▼
                   Wave 5N: Testing    Wave 5O: Security
```

**Key parallelism points:**
- Wave 1: **3 agents** (models, plugins, client shell)
- Wave 2: **4 agents** (auth, reports, discussion, OC+notifications+admin)
- Wave 3: **4 agents** (auth pages, report pages, discussion pages, OC+notifications+admin pages)
- Wave 2 + Wave 3 can **partially overlap** — Wave 3 agents only need Wave 1C (client shell), not Wave 2 results. Frontend agents build against TypeScript types and mock data, then wire to real API endpoints.
- Wave 4: **2 agents** (backend integration, PWA polish)
- Wave 5: **2 agents** (testing, security)

**Total: up to 15 agent tasks across 6 waves, with up to 4 agents running concurrently.**

---

## Agent File Ownership Summary / 代理檔案分配

| Agent | Wave | Owned Directories / Files |
|-------|------|--------------------------|
| Scaffold | 0 | Root configs, `packages/client/` scaffold, `packages/server/` scaffold |
| A | 1 | `server/src/models/*`, `server/migrations/*`, `server/seeders/*` |
| B | 1 | `server/src/plugins/*`, `server/src/middleware/*`, `server/src/utils/*` |
| C | 1 | `client/src/App.tsx`, `client/src/main.tsx`, `client/src/types/*`, `client/src/lib/*`, `client/src/stores/*`, `client/src/components/layouts/*` |
| D | 2 | `server/src/routes/auth.ts`, `server/src/services/auth.service.ts` |
| E | 2 | `server/src/routes/reports.ts`, `server/src/services/report.service.ts` |
| F | 2 | `server/src/routes/discussions.ts`, `server/src/services/discussion.service.ts` |
| G | 2 | `server/src/routes/oc-documents.ts`, `server/src/routes/notifications.ts`, `server/src/routes/admin.ts`, `server/src/services/oc-document.service.ts`, `server/src/services/notification.service.ts`, `server/src/services/push.service.ts` |
| H | 3 | `client/src/pages/auth/*`, `client/src/services/auth.ts` |
| I | 3 | `client/src/pages/reports/*`, `client/src/services/reports.ts` |
| J | 3 | `client/src/pages/discussion/*`, `client/src/services/discussions.ts` |
| K | 3 | `client/src/pages/oc/*`, `client/src/pages/notifications/*`, `client/src/pages/admin/*`, `client/src/services/oc.ts`, `client/src/services/notifications.ts`, `client/src/services/admin.ts` |
| L | 4 | `server/src/app.ts` (final wiring), cross-service triggers, integration tests |
| M | 4 | `client/public/sw.js`, `client/public/manifest.json`, push UI, responsive CSS |
| N | 5 | `server/src/__tests__/*`, `client/src/__tests__/*` |
| O | 5 | Security config files, sanitization logic, validation hardening |
