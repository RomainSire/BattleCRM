# Build context: monorepo root (.)
# Node 24: required by @poppinss/ts-exec (needs Node's native "module-typescript"
# format detection for `node ace build` — absent on Node 20). Matches local dev.
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Build stage: install workspace deps + build shared, then the backend.
# deps and build are kept in a SINGLE stage on purpose: copying pnpm's
# symlinked node_modules across stages breaks the .pnpm store (tsc not found).
FROM base AS build
WORKDIR /app
# Manifests needed to resolve the workspace + the shared package
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
# `...` => install @battlecrm/backend AND its workspace deps (shared).
# --include-workspace-root brings in the root devDeps (typescript) needed to build shared.
RUN pnpm install --frozen-lockfile --filter @battlecrm/backend... --include-workspace-root
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend
# 1) build shared types (generates packages/shared/dist)
RUN pnpm --filter @battlecrm/shared build
# 2) build the backend (Ace) — the ts-exec loader now resolves correctly
WORKDIR /app/apps/backend
RUN node ace build

# Production stage
FROM node:24-alpine AS production
WORKDIR /app
COPY --from=build /app/apps/backend/build .
# @battlecrm/shared is a types-only workspace package (no runtime code). It is not
# needed at runtime and npm can't resolve the `workspace:` protocol — drop it before install.
RUN npm pkg delete "dependencies.@battlecrm/shared" && npm install --omit=dev
ENV NODE_ENV=production
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
USER node
CMD ["node", "bin/server.js"]
