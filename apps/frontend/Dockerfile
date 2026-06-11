# Build context: monorepo root (.) — needed for pnpm workspace and root .env
# Node 24 to match local dev toolchain (consistent tsc/build behavior).
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Build stage: install workspace deps + build shared, then Vite build.
# deps and build are kept in a SINGLE stage on purpose: copying pnpm's
# symlinked node_modules across stages breaks the .pnpm store (tsc not found).
FROM base AS build
WORKDIR /app
# Manifests needed to resolve the workspace + the shared package
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/
# `...` => install @battlecrm/frontend AND its workspace deps (shared).
# --include-workspace-root brings in the root devDeps (typescript) needed to build shared.
RUN pnpm install --frozen-lockfile --filter @battlecrm/frontend... --include-workspace-root
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend
# Build shared types first (frontend's `tsc -b` needs to resolve @battlecrm/shared)
RUN pnpm --filter @battlecrm/shared build
# Inject VITE_ env vars as build-time ARGs (only what's needed — no secrets)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /app/apps/frontend
RUN pnpm run build

# Production stage (nginx serving static files)
FROM nginx:alpine AS production
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
