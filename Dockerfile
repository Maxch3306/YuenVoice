FROM node:20-alpine AS base
LABEL org.opencontainers.image.source="https://github.com/TSUININGGARDEN/YuenVoice"
LABEL org.opencontainers.image.license="MIT"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ── Stage 1: Install dependencies ──
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build client ──
FROM deps AS client-build
ARG VITE_VAPID_PUBLIC_KEY
ENV VITE_VAPID_PUBLIC_KEY=${VITE_VAPID_PUBLIC_KEY}
COPY packages/client/ packages/client/
COPY tsconfig.base.json ./
RUN pnpm --filter client build

# ── Stage 3: Build server ──
FROM deps AS server-build
COPY packages/server/ packages/server/
COPY tsconfig.base.json ./
RUN pnpm --filter server build

# ── Stage 4: Production server image ──
FROM base AS server
ENV NODE_ENV=production

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile --prod --filter server

COPY --from=server-build /app/packages/server/dist/ packages/server/dist/
COPY packages/server/migrations/ packages/server/migrations/
COPY packages/server/seeders/ packages/server/seeders/

WORKDIR /app/packages/server
EXPOSE 3001
CMD ["node", "dist/index.js"]

# ── Stage 5: Production client image (nginx) ──
FROM nginx:alpine AS client

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=client-build /app/packages/client/dist/ /usr/share/nginx/html/

EXPOSE 80
