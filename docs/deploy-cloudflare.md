# Deploying YuenVoice to Cloudflare

YuenVoice runs entirely on Cloudflare: a single **Worker** (Hono) serves the API
and the Vite SPA (static assets), backed by **D1** (database), **Durable Objects**
(sessions/tokens/push-subs), **R2** (uploads), and **KV** (mutable config).

All commands below run from `packages/server/` unless noted.

---

## 1. One-time resource provisioning

Already done for this project, but for reference / a fresh account:

```bash
wrangler login
wrangler d1 create yuenvoice                 # paste database_id into wrangler.jsonc
wrangler r2 bucket create yuenvoice-uploads
wrangler kv namespace create CONFIG          # paste id into wrangler.jsonc
wrangler d1 migrations apply yuenvoice --remote
```

## 2. One-time runtime secrets & config

The deploy workflow never touches these — set them once by hand.

```bash
# Auth secrets (32+ chars each; interactive prompt)
wrangler secret put JWT_ACCESS_SECRET
wrangler secret put JWT_REFRESH_SECRET

# Admin password → KV (source of truth; rotate anytime the same way)
wrangler kv key put --binding=CONFIG "admin:password" "your-strong-admin-pw" --remote

# Seed reference data (flats + discussion boards). Admin is NOT seeded — it
# bootstraps from the KV password on first admin login.
pnpm seed:remote

# (Optional) enable Web Push
npx web-push generate-vapid-keys             # put the PUBLIC key in wrangler.jsonc vars.VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
```

### Rotate the admin password later

```bash
wrangler kv key put --binding=CONFIG "admin:password" "new-pw" --remote
```

Takes effect on the admin's next login (reconciled into D1 automatically).

## 3. GitHub Actions secrets

The workflow ([.github/workflows/deploy-cloudflare.yml](../.github/workflows/deploy-cloudflare.yml))
needs two repo secrets:

```bash
# Account id (already set for this repo)
gh secret set CLOUDFLARE_ACCOUNT_ID --body "<account-id>"

# API token — create at https://dash.cloudflare.com/profile/api-tokens
# Custom token with these Account permissions (Edit):
#   Workers Scripts, D1, Workers KV Storage, Workers R2 Storage
gh secret set CLOUDFLARE_API_TOKEN           # paste the token when prompted
```

## 4. Deploy

The workflow runs automatically on push to `main` (server/client/lockfile changes),
or trigger it manually:

```bash
gh workflow run deploy-cloudflare.yml
gh run watch
```

It builds the SPA, regenerates binding types, typechecks the Worker, applies
pending D1 migrations, and runs `wrangler deploy`.

### Manual deploy (without CI)

```bash
pnpm --filter client build
pnpm --filter server d1:migrate:remote
pnpm --filter server cf:deploy
```

## 5. Local development

```bash
# .dev.vars holds local secrets (gitignored); see .dev.vars.example
pnpm --filter server d1:migrate:local
pnpm --filter server seed:local
pnpm --filter server cf:dev            # wrangler dev on http://localhost:8787
```

Set a local admin password for dev:

```bash
wrangler kv key put --binding=CONFIG "admin:password" "admin123" --local
```

---

## Reference

| Concern | Resource | Binding |
|---|---|---|
| Database | D1 `yuenvoice` | `DB` |
| Uploads | R2 `yuenvoice-uploads` | `UPLOADS` |
| Sessions / tokens / push-subs | Durable Object `SessionStore` | `SESSION_STORE` |
| Mutable config (`admin:password`) | KV `CONFIG` | `CONFIG` |
| SPA | `packages/client/dist` static assets | — |

Runtime secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `VAPID_PRIVATE_KEY`.
Public vars (in `wrangler.jsonc`): `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `ADMIN_EMAIL`, `ADMIN_NAME`, etc.
