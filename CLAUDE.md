# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YUENVOICE is a PWA for a single Hong Kong housing estate — a communication platform connecting residents (業戶), the Owners' Corporation (業主立案法團), and the property management office (管理處). Bilingual: English + Traditional Chinese (繁體中文).

## Tech Stack

- **Frontend**: Vite + React 19 + TypeScript + shadcn/ui + Tailwind CSS v4
- **Backend**: Fastify 5 (Node.js)
- **Database**: PostgreSQL with Sequelize ORM + Umzug (auto-migration on startup)
- **Cache/Realtime**: Redis (ioredis — session tokens, push subscriptions, pub/sub)
- **Auth**: JWT (access 15min + refresh 7d in httpOnly cookie), flat-based registration password
- **Push**: Web Push API (VAPID) via `web-push`
- **Package Manager**: pnpm workspaces
- **Testing**: Vitest + Supertest (server), Vitest + Testing Library (client)

## Architecture

Monorepo with two packages:

- `packages/client/` — Vite React SPA (PWA). React Router v7, Zustand (auth/notification stores), TanStack Query (server state), Axios (API client with token refresh interceptor).
- `packages/server/` — Fastify REST API. Plugin architecture (auth, RBAC, Redis, upload). Service layer pattern: routes → services → Sequelize models. All routes prefixed `/api/`.

State management: Zustand for client-only state (auth, notifications). TanStack Query for server-fetched data (reports, posts, documents).

## Commands

```bash
pnpm install              # Install all workspace dependencies
pnpm dev                  # Run client (Vite 5173) + server (Fastify 3001) concurrently
pnpm build                # Build both packages
pnpm lint                 # Lint both packages
pnpm format               # Prettier format

# Server-specific
pnpm --filter server dev            # Run server only (auto-runs pending migrations on start)
pnpm --filter server build          # TypeScript compile
pnpm --filter server db:migrate     # Run migrations manually (Sequelize CLI)
pnpm --filter server db:seed        # Run seed files
pnpm --filter server db:migrate:undo # Rollback last migration
pnpm --filter server test           # Run server tests (Vitest)

# Client-specific
pnpm --filter client dev            # Run client only
pnpm --filter client build          # Production build
pnpm --filter client typecheck      # TypeScript check without emitting
pnpm --filter client test           # Run client tests
```

## Server Architecture

### Plugin Registration Order (in `src/app.ts`)

Plugins are registered in strict dependency order — do not reorder:

1. `@fastify/cors` → CORS
2. `@fastify/helmet` → Security headers
3. `@fastify/rate-limit` → Global rate limit (100 req/min)
4. `plugins/redis.ts` → ioredis client (`fastify.redis`)
5. `plugins/auth.ts` → `@fastify/cookie` + `@fastify/jwt` + `fastify.authenticate` decorator
6. `plugins/rbac.ts` → `fastify.rbac(roles[])` preHandler factory
7. `plugins/upload.ts` → `@fastify/multipart` + `saveFile()` helper
8. `@fastify/static` → Serves `/uploads/` directory
9. Route plugins (auth → reports → discussions → oc-documents → notifications → admin)
10. Health check (`GET /api/health`)
11. 404 handler

### Route Modules

| Module | Prefix | File | Key Endpoints |
|--------|--------|------|---------------|
| Auth | `/api/auth` | `routes/auth.ts` | register, login, refresh, logout, forgot/reset-password |
| Reports | `/api/reports` | `routes/reports.ts` | CRUD, status update, comments, attachments |
| Discussion | `/api/boards`, `/api/posts` | `routes/discussions.ts` | boards, posts, comments, reactions, flag, moderate |
| OC Documents | `/api/oc-documents` | `routes/oc-documents.ts` | list, upload, view, delete |
| Notifications | `/api/notifications`, `/api/push` | `routes/notifications.ts` | send, list, mark-read, push subscribe |
| Admin | `/api/admin` | `routes/admin.ts` | users, flats, audit-logs |

Note: Auth routes use relative paths (registered with prefix). All other route files use absolute paths (e.g., `/api/boards`) and are registered without a prefix.

### Service Layer Pattern

Routes delegate to services (`src/services/`). Services contain business logic and interact with models:
```
Route handler → Service function → Sequelize model
                                 → Redis (cache/session)
                                 → Audit log (fire-and-forget)
```

### Utility Modules

- `utils/hash.ts` — `hashPassword()`, `comparePassword()` (bcrypt, cost 12)
- `utils/pagination.ts` — `parsePagination(query)`, `paginatedResponse(rows, count, page, limit)`
- `utils/audit.ts` — `logAudit(userId, action, entityType, entityId, metadata?)` (fire-and-forget)
- `middleware/rate-limit.ts` — Presets: `authRateLimit` (10/min), `writeRateLimit` (20/min), `defaultRateLimit` (100/min)

## Database Migration Rules

**Never use `sequelize.sync()` or `alter: true`.** All schema changes must go through migration files.

When making database changes:

1. **Create a new migration file** in `packages/server/migrations/` (`.cjs` format, timestamped name)
2. **Update the corresponding model** in `packages/server/src/models/` to match
3. **Never modify an existing migration** that has already been run — create a new one instead

Migration naming: `YYYYMMDDHHMMSS-description.cjs` (e.g., `20260329100000-add-push-subscription-to-users.cjs`)

Each migration must have both `up` (apply change) and `down` (revert change) functions.

**Auto-migration on startup:** The server uses Umzug to automatically run pending migrations when it starts (`src/index.ts`). The `SequelizeMeta` table tracks which migrations have been executed. This means:
- Adding a new migration file → server runs it on next restart
- No need to manually run `pnpm --filter server db:migrate` during development
- Migrations run step by step in filename order, not all at once via sync

### Model Conventions

- All primary keys: `DataTypes.UUID`, `defaultValue: DataTypes.UUIDV4`
- `underscored: true` — JS camelCase maps to DB snake_case (e.g., `flatId` → `flat_id`)
- `timestamps: true` (default) — auto `created_at`, `updated_at`
- Sequelize instance: `src/models/sequelize.ts` (extracted to avoid circular imports)
- Associations defined in `src/models/index.ts`
- No soft deletes — audit log tracks destructive actions

## Client Architecture

### Auth Flow

- Access token: in-memory (Zustand `auth-store`), never in localStorage
- Refresh token: httpOnly secure cookie, path `/api/auth`, sameSite strict
- Axios interceptor: on 401, queues request, calls `/api/auth/refresh`, retries; on fail, logout + redirect to `/login`

### Routing (`src/App.tsx`)

```
/login, /register, /forgot-password, /reset-password → AuthLayout (public)
/reports/*, /discussion/*, /oc/*, /notifications    → MainLayout (ProtectedRoute)
/admin/*                                             → AdminLayout (ProtectedRoute + AdminRoute)
/                                                    → redirect to /reports
```

- `ProtectedRoute`: checks `useAuthStore().isAuthenticated`, redirects to `/login`
- `AdminRoute`: checks `user.role === 'admin'`, redirects to `/`

### State Management

- `stores/auth-store.ts` — user, accessToken, isAuthenticated, setAuth(), logout()
- `stores/notification-store.ts` — unreadCount, notifications, markAsRead(), setUnreadCount()
- TanStack Query — all server data with query key factories per service module

### API Service Pattern

Each service file (`src/services/*.ts`) exports:
- Typed API functions using the Axios instance from `lib/api.ts`
- TanStack Query hooks (useQuery/useMutation) with query key factories
- Example: `services/reports.ts` → `getReports()`, `useReports()`, `useCreateReport()`

### PWA

- Service Worker: `public/sw.js` (cache-first for shell, network-first for API, push handler)
- Manifest: `public/manifest.json`
- Components: `ErrorBoundary`, `OfflineBanner`, `InstallPrompt`
- Push helpers: `lib/push.ts`

## Key Conventions

- **4 user roles**: `resident`, `oc_committee`, `mgmt_staff`, `admin` — enforced via RBAC preHandler
- **Flat registration password**: residents must provide their flat's pre-assigned password to register; passwords are bcrypt-hashed
- **Audit logging** for all state-changing operations by mgmt/admin roles
- **File uploads**: multipart via @fastify/multipart, validated by magic bytes, stored at `uploads/{entity}/{yyyy-mm}/{uuid}.{ext}`
- **Anonymous posting**: `is_anonymous` flag; real `author_id` stored but responses show "匿名業戶"
- **ESM imports**: server uses `"type": "module"` — all import paths must use `.js` extensions

## UI/Design System

- **shadcn/ui preset**: `b6FmLbsX4` (Style: Maia, Base: Olive, Theme: Orange, Radius: Medium)
- **Init**: `pnpm dlx shadcn@latest init --preset b6FmLbsX4 --template vite --rtl`
- **Fonts**: JetBrains Mono (headings/UI) + Noto Sans HK (Traditional Chinese body text)
- **Icons**: HugeIcons (`@hugeicons/react`) — do not mix with Lucide or other icon libraries
- **Colors**: Use shadcn CSS variable classes (`bg-primary`, `text-muted-foreground`), not hardcoded hex
- **CJK rules**: min 14px for Chinese text, line-height 1.6, use `font-sans` class on CJK-heavy blocks
- **Theme**: Dark/light/system mode with `ThemeProvider`, toggle via keyboard shortcut `D`
- Full design system: `design-system/yuenvoice/MASTER.md`

## Documentation

- `docs/PRD.md` — Full product requirements with data models, API endpoints, permission matrix
- `docs/architecture.md` — System diagrams, project structure, DB schema, Redis patterns, deployment
- `docs/development-plan.md` — Wave-based parallel development plan with agent file ownership
- `docs/tasks/` — Individual task files (15 tasks across 6 waves) with deliverables and acceptance criteria
- `docs/ui/sitemap.md` — Route map, page inventory, layouts, navigation, user flows
- `docs/ui/pages/` — Page-level UI wireframes and component specs for all 18 pages
