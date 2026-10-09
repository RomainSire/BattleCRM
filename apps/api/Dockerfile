# The API image, with its `main` and `migrate` entry points (spec stack §10.1).
# Built from the repository root: docker build -f apps/api/Dockerfile --build-arg VERSION=1.2.3 .
FROM node:24.17.0-alpine AS build
RUN corepack enable
WORKDIR /repo
# The store only depends on the lockfile: this layer survives source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter @battlecrm/api \
  && pnpm --filter @battlecrm/api build \
  && pnpm --filter @battlecrm/api deploy --prod /out

FROM node:24.17.0-alpine
ARG VERSION=dev
ENV NODE_ENV=production \
  APP_VERSION=$VERSION
WORKDIR /app
COPY --from=build /out ./
# What deploy.sh installs next to the secrets, so that each tag brings its own (spec stack §10.3).
COPY ops/prod/docker-compose.prod.yml ops/prod/backup.sh /ops/
COPY ops/postgres /ops/postgres
USER node
EXPOSE 3000
ENTRYPOINT ["node"]
CMD ["dist/main.js"]
