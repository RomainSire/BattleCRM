# The web image: nginx serves the SPA on APP_HOST and the landing on SITE_HOST (spec stack §10.1).
# Built from the repository root: docker build -f apps/web/Dockerfile .
FROM node:24.17.0-alpine AS build
RUN corepack enable
WORKDIR /repo
# The store only depends on the lockfile: this layer survives source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY . .
# The version the SPA reports with its uncaught errors (spec stack §11).
ARG VERSION=dev
RUN pnpm install --offline --frozen-lockfile --filter @battlecrm/web... \
  && VITE_APP_VERSION=$VERSION pnpm --filter @battlecrm/web build

FROM nginxinc/nginx-unprivileged:1.30.5-alpine
# Rendered into conf.d at start, with APP_HOST and SITE_HOST from the environment.
COPY ops/web/default.conf.template /etc/nginx/templates/
COPY ops/web/security-headers.conf /etc/nginx/snippets/
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html/app
