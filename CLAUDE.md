# CLAUDE.md

YUENVOICE is a bilingual (English + Traditional Chinese) PWA for a Hong Kong housing estate — connecting residents (業戶), the Owners' Corporation (業主立案法團), and the property management office (管理處).

It runs entirely on Cloudflare: **one Worker** (Hono) serves the API *and* the Vite SPA, backed by D1, Durable Objects, R2, and KV. There is no Node server, no Postgres, and no Redis in the deployed system.

## Tech Stack

- **Frontend**: Vite + React 19 + TypeScript + shadcn/ui + Tailwind CSS v4
- **Backend**: Hono 4 on Cloudflare Workers, ESM (`"type": "module"`)
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM + `wrangler d1 migrations`
- **Sessions / tokens / push subs**: Durable Object `SessionStore` (replaces Redis)
- **File storage**: R2 bucket `yuenvoice-uploads` (replaces local disk)
- **Mutable config**: KV namespace `CONFIG` (holds `admin:password`)
- **Auth**: JWT via `jose` (access 15min + refresh 7d httpOnly cookie), flat-based registration
- **Password hashing**: WebCrypto PBKDF2-HMAC-SHA256, 100k iterations (`utils/hash.ts`)
- **Validation**: Zod + `@hono/zod-validator`; sanitization via `xss`
- **Push**: Web Push API (VAPID) via `@mmmike/web-push` (Workers-compatible)
- **Monorepo**: pnpm workspaces — `packages/client/` and `packages/server/`
- **Testing**: Vitest (both packages) + Testing Library (client)

### Retired stack still in the repo

`packages/server/` also contains the **pre-Cloudflare Fastify/Sequelize/Postgres/Redis
implementation**, which is dead code — not deployed, not reachable from `src/worker.ts`:

| Retired (do not extend) | Live equivalent |
|---|---|
| `src/index.ts`, `src/app.ts` (Fastify) | `src/worker.ts`, `src/http/app.ts` (Hono) |
| `src/routes/`, `src/services/` | `src/http/routes/`, `src/http/services/` |
| `src/models/` (Sequelize), `migrations/`, `seeders/` | `src/db/schema.ts` (Drizzle), `drizzle/`, `scripts/seed.mjs` |
| `src/plugins/`, `src/middleware/rate-limit.ts` | `src/http/middleware/`, `src/http/upload.ts` |
| `src/__tests__/` (builds the Fastify app) | no Worker test suite yet |

`src/utils/` is shared in name only — `hash.ts` is the live Workers PBKDF2 implementation;
`setup.ts` / `env-validator.ts` belong to the retired Node path.

**All new server work goes in `src/http/` and `src/db/schema.ts`.** Treat the retired tree
as removable; do not mirror changes into it.

## Commands

```bash
pnpm install                            # Install all workspace deps
pnpm --filter client dev                # SPA dev server (5173)
pnpm --filter server cf:dev             # Worker via wrangler dev (8787) — the real backend
pnpm --filter server cf:typecheck       # Typecheck the Worker (tsconfig.worker.json)
pnpm --filter server cf:types           # Regenerate binding types (worker-configuration.d.ts)
pnpm --filter server d1:generate        # Generate a D1 migration from schema.ts changes
pnpm --filter server d1:migrate:local   # Apply migrations to the local D1 simulation
pnpm --filter server d1:migrate:remote  # Apply migrations to production D1
pnpm --filter server seed:local         # Seed flats + discussion boards locally
pnpm --filter server cf:deploy          # wrangler deploy
pnpm --filter client build              # Build the SPA (Worker serves packages/client/dist)
pnpm --filter client typecheck          # TypeScript check without emit
pnpm --filter client test               # Client tests
pnpm lint                               # Lint both packages
```

`pnpm dev` and `pnpm --filter server dev|test|db:*` still drive the **retired** Fastify stack
and need Postgres + Redis. Use `cf:dev` for backend work.

## MUST / MUST NOT Rules

### Git

- **MUST** use atomic commits — one logical change per commit (e.g., don't mix a bug fix with a refactor or docs update)
- **MUST** write commit messages that explain *why*, not just *what*
- **MUST** commit schema + migration + route/service changes together when they form one feature
- **MUST NOT** commit unrelated changes in the same commit

### Database (D1 + Drizzle)

- **MUST** change `src/db/schema.ts` first, then run `pnpm --filter server d1:generate` to emit SQL into `drizzle/`
- **MUST NOT** hand-edit a generated migration that has already been applied — change the schema and generate a new one
- **MUST NOT** use `sequelize.sync()`, `drizzle-kit push`, or any auto-alter against a live database
- **MUST** apply migrations explicitly — they do **not** auto-run on Worker start (`d1:migrate:local` / `:remote`, and CI runs `:remote` before deploy)
- **MUST** keep column names snake_case (the client consumes that shape) and generate UUID PKs / ISO-8601 timestamps app-side via the helpers at the top of `schema.ts`
- **MUST NOT** add Postgres-only types — D1 is SQLite (booleans are `integer({mode:'boolean'})`, JSON is `text({mode:'json'})`)

### Server Code

- **MUST** use `.js` extensions in all ESM import paths
- **MUST** follow the route mount order in `src/http/app.ts` — `discussionRoutes` mounts at `/api` **last** because its blanket `use('*', requireAuth())` would otherwise gate sibling `/api` routes
- **MUST** use the service layer pattern: Hono handler → `src/http/services/*` → Drizzle/Durable Object/R2
- **MUST** reach state through bindings on `c.env` (`DB`, `UPLOADS`, `SESSION_STORE`, `CONFIG`) — no module-level clients, no global mutable state (Workers isolates are reused across requests)
- **MUST** hash passwords with `utils/hash.ts` (PBKDF2). **MUST NOT** raise the iteration count above 100_000 — the Workers runtime rejects more (`NotSupportedError`), and `wrangler dev` will *not* catch it
- **MUST** validate request input with Zod via `@hono/zod-validator`, and sanitize user text with `http/sanitize.ts`
- **MUST** log audit entries for all state-changing operations by mgmt/admin roles (via `http/audit.ts`)
- **MUST** validate file uploads by magic bytes (via `http/upload.ts`) — never trust the client MIME type
- **MUST** throw `HttpError` from `http/errors.ts` for expected failures; `app.onError` maps it to JSON
- Use only Workers-compatible APIs: no `fs`, no Node crypto, no long-lived sockets

### Durable Object state (SessionStore)

- **MUST** address stores through the helpers in `http/session-store.ts` — `userStore(env, userId)` (`session:refresh`, `push:sub`) and `tokenStore(env, token)` (password-reset tokens). Sharding by entity is what makes refresh-token rotation strongly consistent
- **MUST** pass a TTL when writing anything session- or token-scoped; the DO's `alarm()` sweeps expirations
- **MUST NOT** store a raw refresh/reset token — store its SHA-256 (`http/crypto.ts`)

### Client Code

- **MUST** use HugeIcons (`@hugeicons/react`) — do not mix with Lucide or other icon libraries
- **MUST** use shadcn CSS variable classes (`bg-primary`, `text-muted-foreground`) — no hardcoded hex
- **MUST** keep access tokens in-memory only (Zustand `auth-store`) — never localStorage
- **MUST** use TanStack Query for all server-fetched data, Zustand only for client-only state
- **MUST** export TanStack Query hooks from service files (`src/services/*.ts`)

### CJK / Bilingual

- **MUST** use min 14px for Chinese text, line-height 1.6
- **MUST** use `font-sans` class on CJK-heavy blocks
- Fonts: JetBrains Mono (headings/UI) + Noto Sans HK (Chinese body text)

## Key Architecture Decisions

> For full details, see [docs/architecture.md](docs/architecture.md) and [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md)

- **Single Worker, two surfaces**: `wrangler.jsonc` `assets.run_worker_first: ["/api/*", "/uploads/*"]` — everything else falls back to `index.html` for SPA routing. Same-origin by default, so the httpOnly refresh cookie needs no CORS (CORS only activates when `CLIENT_ORIGIN` is set).
- **4 user roles**: `resident`, `oc_committee`, `mgmt_staff`, `admin` — enforced via `requireAuth()` + `requireRole()` middleware.
- **OC committee is review-only**: can read every report + mgmt response and every discussion post, but cannot file tickets, leave comments, or author posts. Reactions and post flags stay open. Mgmt/admin/resident retain write access. Residents see only their own reports.
- **Flat registration**: residents provide their flat's pre-assigned password (PBKDF2-hashed) to register. `users.flat_id` is **nullable** so admins can create non-resident mgmt/committee accounts without a flat.
- **Admin password lives in KV**, not in a seed: `CONFIG['admin:password']` is the source of truth. The admin row bootstraps/reconciles from it on the next admin login, so rotating the password is a `wrangler kv key put` with no redeploy.
- **Multi-unit owners**: residents who own more than one flat link extra units via `user_flats` (composite PK), surfaced through `/api/users/me/flats` and the `/profile/flats` page. Discussion-board scoping uses every linked flat's block/floor.
- **Anonymous posting**: `is_anonymous` flag; real `author_id` stored but responses show "匿名業戶".
- **Auto-reopen on follow-up**: a non-mgmt comment on a `completed` report transitions it back to `in_progress`, writes an audit entry, and notifies all mgmt/admin users (DB + web push, fire-and-forget). Once a report has been auto-reopened 3+ times, an additional escalation notification is fanned out to all `oc_committee` users on the 3rd and every subsequent reopen. The UI warns residents before they comment.
- **File uploads**: R2 objects keyed `{entity}/{yyyy-mm}/{uuid}.{ext}`, validated by magic bytes, served from `/uploads/*` with `immutable` caching. Keys are unguessable UUIDs and the route is **unauthenticated** — treat an upload URL as a capability.
- **Notifications**: `target_type` is `all | block | floor | user`; per-recipient rows in `user_notifications` carry read state, and web push is fire-and-forget so a push failure never fails the request.
- **OC documents**: support both file-backed (PDF/image upload) and link-backed (`external_url` + `link_type` enum: `google_meet` / `google_drive` / `google_site`) — used for meeting livestreams and recordings.
- **Soft delete**: only `users.deleted_at` (admin soft-delete). No other table soft-deletes; the audit log is the record of destructive actions.

## UI/Design System

> Full design system: [design-system/yuenvoice/MASTER.md](design-system/yuenvoice/MASTER.md)

- **shadcn/ui preset**: `b6FmLbsX4` (Style: Maia, Base: Olive, Theme: Orange, Radius: Medium)
- **Init command**: `pnpm dlx shadcn@latest init --preset b6FmLbsX4 --template vite --rtl`
- **Theme**: Dark/light/system mode with `ThemeProvider`, toggle via keyboard shortcut `D`

## Documentation — Read When Needed

| Document | Read when... |
|----------|-------------|
| [docs/PRD.md](docs/PRD.md) | Adding features, clarifying business rules, checking permission matrix |
| [docs/architecture.md](docs/architecture.md) | Making architectural decisions, adding integrations, checking DB schema |
| [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md) | Provisioning resources, rotating secrets, deploying, local Worker dev |
| [docs/ui/sitemap.md](docs/ui/sitemap.md) | Adding pages, modifying navigation, checking user flows |
| [docs/ui/pages/](docs/ui/pages/) | Implementing or modifying specific page UIs (wireframes + component specs) |
| [design-system/yuenvoice/MASTER.md](design-system/yuenvoice/MASTER.md) | Styling components, choosing design tokens, checking color/typography |
| [docs/development-plan.md](docs/development-plan.md) | Understanding how features were structured across build waves |

## Implementation Status

All core features (Waves 0–5) are implemented, plus follow-up iterations (multi-unit owners,
OC committee review-only role, auto-reopen + escalation, link-backed OC documents, manual
notification compose, admin user/flat CRUD) — and the whole backend has since been ported
from Fastify/Postgres/Redis to Hono/D1/Durable Objects on Cloudflare Workers.

**Counts (live Workers path):** 15 D1 tables, 9 route modules, 8 service modules, 20 client pages.

**Deployment:** GitHub Actions workflow `.github/workflows/deploy-cloudflare.yml` (or `wrangler deploy`)
builds the SPA, regenerates binding types, typechecks the Worker, applies pending D1 migrations,
and deploys. Worker config in `packages/server/wrangler.jsonc`. The prior Docker/Traefik/GHCR
stack has been retired.

### Not yet built / known gaps

- **Rate limiting** — the retired Fastify stack had per-route limits; the Worker has **none** yet
- **Password reset delivery** — `/auth/forgot-password` and `/auth/reset-password` are implemented server-side, but the reset token is only `console.info`-logged; no email/SMS provider is wired
- **Server test suite for the Worker** — the existing tests build the retired Fastify app; there is no `workers-pool` Vitest setup yet
- Real-time WebSocket/SSE (currently polling via TanStack Query)
- In-app PDF viewer for OC documents (currently iframe/download)
- Removal of the retired Fastify/Sequelize tree and its dependencies from `packages/server`
