import { fileURLToPath } from 'node:url';

import { loadMigrationConfig } from './config.ts';
import { assertPostgresReachable, runMigrations } from './db/index.ts';

// Same relative path from src/migrate.ts and from the bundled dist/migrate.js.
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

const { databaseUrl } = loadMigrationConfig(process.env);
await assertPostgresReachable(databaseUrl);
await runMigrations(databaseUrl, migrationsFolder);
