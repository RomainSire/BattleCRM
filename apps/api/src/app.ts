import { randomUUID } from 'node:crypto';

import type { HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { routePath } from 'hono/route';
import { secureHeaders } from 'hono/secure-headers';
import type { Logger } from 'pino';

import { failureReason, type Alert } from './alert.ts';
import { createAuth, type Hibp } from './auth/index.ts';
import { CLIENT_ERROR_MAX_BYTES, clientErrorReport } from './client-errors.ts';
import { resolveClientIp } from './client-ip.ts';
import type { Clock } from './clock.ts';
import type { Config } from './config.ts';
import { isDatabaseReady } from './db/index.ts';
import { createEmailSender, type EmailTransport } from './email/index.ts';
import { createGestures } from './gestures/index.ts';
import type { InFlight } from './in-flight.ts';
import { jsonBody } from './json-body.ts';
import { createProspecting } from './prospecting/index.ts';
import type { Random } from './random.ts';
import { initializeSettings } from './settings/index.ts';
import { createViews, summaryChanges } from './views/index.ts';

/** The composition root: every boundary is injected, so a test drives time and randomness. */
export type AppDependencies = {
  config: Config;
  clock: Clock;
  random: Random;
  logger: Logger;
  alert: Alert;
  email: EmailTransport;
  hibp: Hibp;
  /** The sends never awaited, which a shutdown waits for. */
  inFlight: InFlight;
};

export type AppEnv = {
  // Absent under app.request() in tests.
  Bindings: Partial<HttpBindings>;
  Variables: {
    requestId: string;
    clientIp: string | undefined;
    /** Set once auth knows the User. */
    userId?: string;
  };
};

export function createApp({
  config,
  clock,
  random,
  logger,
  alert,
  email,
  hibp,
  inFlight,
}: AppDependencies) {
  const app = new Hono<AppEnv>().basePath('/api');
  const auth = createAuth({
    config,
    clock,
    random,
    logger,
    hibp,
    sendEmail: createEmailSender({ transport: email, logger, alert, inFlight }),
    // Each module writes what a new User starts with (Standard stages will join with their ticket).
    onAccountCreated: [initializeSettings],
  });

  const { requireUser } = auth;
  const prospecting = createProspecting({ clock, requireUser, changesOf: summaryChanges });
  // Each module brings the inverse of its own gestures (ADR 0011).
  const gestures = createGestures({
    clock,
    requireUser,
    inverses: { ...prospecting.inverses },
    changesOf: summaryChanges,
  });
  const views = createViews({ requireUser });

  app.use(async (c, next) => {
    const start = performance.now();
    // Always generated here: an id sent by the client could forge or collide log lines.
    c.set('requestId', randomUUID());
    c.header('X-Request-Id', c.var.requestId);
    await next();
    c.header('X-App-Version', config.appVersion);
    // Chosen fields only (spec stack §11): neither the URL, nor headers, nor bodies, nor the IP.
    logger.info(
      {
        method: c.req.method,
        route: routePath(c, -1),
        status: c.res.status,
        durationMs: Math.round(performance.now() - start),
        userId: c.var.userId,
        requestId: c.var.requestId,
      },
      'request',
    );
  });
  app.use(secureHeaders());
  app.use(csrf({ origin: config.trustedOrigins }));
  app.use(async (c, next) => {
    const remoteAddress = c.env?.incoming?.socket.remoteAddress;
    c.set(
      'clientIp',
      resolveClientIp(remoteAddress, c.req.header('X-Forwarded-For'), config.trustedProxies),
    );
    await next();
  });

  // Routes are chained so that AppType carries them to the SPA's typed client (hc).
  const routes = app
    .get('/health', async (c) =>
      (await isDatabaseReady())
        ? c.json({ status: 'ok', version: config.appVersion })
        : c.json({ status: 'unavailable', version: config.appVersion }, 503),
    )
    .route('/', auth.routes)
    .route('/', prospecting.routes)
    .route('/', gestures.routes)
    .route('/', views.routes)
    .post(
      '/client-errors',
      auth.requireUser,
      bodyLimit({ maxSize: CLIENT_ERROR_MAX_BYTES }),
      jsonBody(clientErrorReport),
      (c) => {
        logger.error(
          { clientError: c.req.valid('json'), requestId: c.var.requestId },
          'client error',
        );
        alert.down('browser error');
        return c.body(null, 204);
      },
    );

  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    logger.error({ err: error, requestId: c.var.requestId }, 'unexpected error');
    // The type and the route template only: an error message may quote user content.
    alert.down(failureReason(error, `${c.req.method} ${routePath(c, -1)}`));
    return c.json({ error: 'internal' }, 500);
  });

  return { app: routes, jobs: auth.jobs };
}

export type AppType = ReturnType<typeof createApp>['app'];
