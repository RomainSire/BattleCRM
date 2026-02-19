# Build context: monorepo root (.)
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile --filter @battlecrm/backend

# Build stage
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY apps/backend ./apps/backend
WORKDIR /app/apps/backend
RUN node ace build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/apps/backend/build .
RUN npm install --omit=dev
ENV NODE_ENV=production
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
USER node
CMD ["node", "bin/server.js"]
