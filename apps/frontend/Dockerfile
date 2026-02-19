# Build context: monorepo root (.) — needed for pnpm workspace and root .env
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
RUN pnpm install --frozen-lockfile --filter @battlecrm/frontend

# Build stage (Vite build)
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY apps/frontend ./apps/frontend
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
