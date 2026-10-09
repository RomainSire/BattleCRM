// The Postgres of compose.dev.yml locally, `services: postgres` in CI: same credentials (ops/postgres/initdb).
const server = process.env['TEST_POSTGRES_HOST'] ?? 'localhost:5432';

export const superuserUrl = (database: string) =>
  `postgres://postgres:postgres@${server}/${database}`;
export const ownerUrl = (database: string) =>
  `postgres://battlecrm_owner:owner@${server}/${database}`;
export const appUrl = (database: string) => `postgres://battlecrm_app:app@${server}/${database}`;
