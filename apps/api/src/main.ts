import { serve } from '@hono/node-server';

import { failureReason, noAlert, uptimeKumaAlert } from './alert.ts';
import { createApp } from './app.ts';
import { systemClock } from './clock.ts';
import { loadConfig } from './config.ts';
import { closeDatabase, openDatabase } from './db/index.ts';
import { createInFlight } from './in-flight.ts';
import { createScheduler } from './jobs/index.ts';
import { createLogger } from './logger.ts';
import { cryptoRandom } from './random.ts';

const config = loadConfig(process.env);
const logger = createLogger(config.logLevel);
openDatabase(config.databaseUrl, logger);

const inFlight = createInFlight();
const alert = config.uptimeKumaPushUrl
  ? uptimeKumaAlert({ pushUrl: config.uptimeKumaPushUrl, logger, inFlight })
  : noAlert;

const app = createApp({ config, clock: systemClock, random: cryptoRandom, logger, alert });
const server = serve({ fetch: app.fetch, port: config.port }, ({ port }) =>
  logger.info({ port, version: config.appVersion }, 'listening'),
);

// Each module registers its jobs here with its ticket (spec stack §10.6); the loop already proves the API is up.
const scheduler = createScheduler({ jobs: [], alert, logger });
scheduler.start();

process.once('SIGTERM', () => {
  const jobsEnded = scheduler.stop();
  // Once the last request is answered: at most ~5 s for the sends in flight (spec stack §8).
  server.close(() => void jobsEnded.then(() => inFlight.settle(5_000)).then(closeDatabase));
});

// Nothing caught it (an unhandled rejection included): alert, then exit so that Docker restarts the API.
process.once('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception');
  alert.down(failureReason(error, 'process'));
  void inFlight.settle(5_000).then(() => process.exit(1));
});
