# CLAUDE.md

YUENVOICE is a bilingual (English + Traditional Chinese) PWA for a Hong Kong housing estate — connecting residents (業戶), the Owners' Corporation (業主立案法團), and the property management office (管理處).

## Tech Stack

- **Frontend**: Vite + React 19 + TypeScript + shadcn/ui + Tailwind CSS v4
- **Backend**: Fastify 5 (Node.js), ESM (`"type": "module"`)
- **Database**: PostgreSQL + Sequelize ORM + Umzug (auto-migration on startup)
- **Cache/Realtime**: Redis (ioredis — sessions, push subscriptions, pub/sub)
- **Auth**: JWT (access 15min + refresh 7d httpOnly cookie), flat-based registration
- **Push**: Web Push API (VAPID) via `web-push`
- **Monorepo**: pnpm workspaces — `packages/client/` and `packages/server/`
- **Testing**: Vitest + Supertest (server), Vitest + Testing Library (client)

## Commands

```bash
pnpm install                          # Install all workspace deps
pnpm dev                              # Run client (5173) + server (3001) concurrently
pnpm build                            # Build both packages
pnpm lint                             # Lint both packages
pnpm --filter server dev              # Server only (auto-runs pending migrations)
pnpm --filter server test             # Server tests
pnpm --filter client dev              # Client only
pnpm --filter client test             # Client tests
pnpm --filter client typecheck        # TypeScript check without emit
```

## MUST / MUST NOT Rules

### Git

- **MUST** use atomic commits — one logical change per commit (e.g., don't mix a bug fix with a refactor or docs update)
- **MUST** write commit messages that explain *why*, not just *what*
- **MUST** commit migration + model + route/service changes together when they form one feature
- **MUST NOT** commit unrelated changes in the same commit

### Database

- **MUST** create a new migration file for every schema change — never use `sequelize.sync()` or `alter: true`
- **MUST** use `.cjs` format, timestamped name: `YYYYMMDDHHMMSS-description.cjs`
- **MUST** include both `up` and `down` functions in migrations
- **MUST** update the corresponding model in `src/models/` to match any migration
- **MUST NOT** modify an existing migration that has already been run — create a new one
- Migrations auto-run on server startup via Umzug (no manual `db:migrate` needed in dev)

### Server Code

- **MUST** use `.js` extensions in all ESM import paths
- **MUST** follow the plugin registration order in `src/app.ts` — do not reorder
- **MUST** use the service layer pattern: route handler → service function → model/Redis
- **MUST** use Argon2id for password hashing (via `utils/hash.ts`)
- **MUST** log audit entries for all state-changing operations by mgmt/admin roles (via `utils/audit.ts`)
- **MUST** validate file uploads by magic bytes (via `plugins/upload.ts`)

### Redis Key Type Changes

- **MUST** guard against legacy key types when changing a Redis key's data structure (e.g., string → hash)
- **MUST** check `redis.type(key)` before operating and migrate/delete old keys to avoid `WRONGTYPE` errors
- **MUST NOT** assume Redis keys are a specific type — production may have old keys from prior code

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

> For full details, see [docs/architecture.md](docs/architecture.md)

- **4 user roles**: `resident`, `oc_committee`, `mgmt_staff`, `admin` — enforced via RBAC preHandler
- **OC committee is review-only**: can read every report + mgmt response and every discussion post, but cannot file tickets, leave comments, or author posts. Reactions and post flags stay open. Mgmt/admin/resident retain write access. Residents see only their own reports.
- **Flat registration**: residents provide their flat's pre-assigned password (argon2-hashed) to register. `User.flat_id` is **nullable** so admins can create non-resident mgmt/committee accounts without a flat.
- **Multi-unit owners**: residents who own more than one flat link extra units via `user_flats` (composite PK), surfaced through `/api/users/me/flats` and the `/profile/flats` page. Discussion-board scoping uses every linked flat's block/floor.
- **Anonymous posting**: `is_anonymous` flag; real `author_id` stored but responses show "匿名業戶"
- **Auto-reopen on follow-up**: a non-mgmt comment on a `completed` report transitions it back to `in_progress`, writes an audit entry, and notifies all mgmt/admin users (DB + web push, fire-and-forget). Once a report has been auto-reopened 3+ times, an additional escalation notification is fanned out to all `oc_committee` users on the 3rd and every subsequent reopen. The UI warns residents before they comment.
- **File uploads**: stored at `uploads/{entity}/{yyyy-mm}/{uuid}.{ext}`, validated by magic bytes
- **OC documents**: support both file-backed (PDF/image upload) and link-backed (`external_url` + `link_type` enum: `google_meet` / `google_drive` / `google_site`) — used for meeting livestreams and recordings.
- **Model conventions**: UUID PKs, `underscored: true` (camelCase → snake_case), `timestamps: true`, no soft deletes
- **Sequelize instance**: extracted to `src/models/sequelize.ts` to avoid circular imports; associations in `src/models/index.ts`

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
| [docs/ui/sitemap.md](docs/ui/sitemap.md) | Adding pages, modifying navigation, checking user flows |
| [docs/ui/pages/](docs/ui/pages/) | Implementing or modifying specific page UIs (wireframes + component specs) |
| [design-system/yuenvoice/MASTER.md](design-system/yuenvoice/MASTER.md) | Styling components, choosing design tokens, checking color/typography |
| [docs/development-plan.md](docs/development-plan.md) | Understanding how features were structured across build waves |

## Implementation Status

All core features (Waves 0–5) are **implemented** plus follow-up iterations: auth, reports, discussion boards, OC documents, notifications, admin dashboard, PWA, multi-unit owner support, OC committee review-only role, auto-reopen on resident follow-up, and CI image build.

**Counts:** 16 models, 16 migrations, 7 route modules, 7 service modules, 21 pages.

**Deployment:** Runs entirely on Cloudflare — a single Worker (Hono) serves the API + the Vite SPA (static assets), backed by D1 (database), Durable Objects (sessions/tokens/push-subs), R2 (uploads), and KV (mutable config, incl. the admin password). Deploy via GitHub Actions workflow `.github/workflows/deploy-cloudflare.yml` (or `wrangler deploy`). See [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md). Worker config in `packages/server/wrangler.jsonc`; local dev via `pnpm --filter server cf:dev` (wrangler dev). The prior Docker/Traefik/GHCR stack has been retired.

### Not yet built (future work)

- Password reset routes (`/auth/forgot-password`, `/auth/reset-password`) and SMS/email provider — UI pages exist, server endpoints not yet wired
- S3 file storage (local filesystem only — `UPLOAD_PROVIDER=local`)
- Real-time WebSocket/SSE (currently polling via TanStack Query + Redis pub/sub for fan-out)
- In-app PDF viewer for OC documents (currently iframe/download)
- Comprehensive test suite (auth, routes, smoke tests exist; coverage is minimal)
