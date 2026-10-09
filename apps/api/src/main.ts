import { serve } from '@hono/node-server';

import { createApp } from './app.ts';
import { systemClock } from './clock.ts';
import { loadConfig } from './config.ts';
import { closeDatabase, openDatabase } from './db/index.ts';
import { createLogger } from './logger.ts';
import { cryptoRandom } from './random.ts';

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
openDatabase(config.databaseUrl, logger);

const app = createApp({ config, clock: systemClock, random: cryptoRandom, logger });
const server = serve({ fetch: app.fetch, port: config.port }, ({ port }) =>
  logger.info({ port, version: config.appVersion }, 'listening'),
);

process.once('SIGTERM', () => {
  server.close(() => void closeDatabase());
});
