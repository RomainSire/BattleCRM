import { defineConfig } from 'drizzle-kit';

// Generates migrations only: they are applied by the `migrate` entry point, never by `drizzle-kit push`.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/*/tables.ts',
  out: './drizzle',
});
