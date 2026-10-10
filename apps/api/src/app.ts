import { randomUUID } from 'node:crypto';

import type { HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { routePath } from 'hono/route';
import { secureHeaders } from 'hono/secure-headers';
import { validator } from 'hono/validator';
import type { Logger } from 'pino';

import { failureReason, type Alert } from './alert.ts';
import { CLIENT_ERROR_MAX_BYTES, clientErrorReport } from './client-errors.ts';
import { resolveClientIp } from './client-ip.ts';
import type { Clock } from './clock.ts';
import type { Config } from './config.ts';
import { isDatabaseReady } from './db/index.ts';
import type { Random } from './random.ts';

/** The composition root: every boundary is injected, so a test drives time and randomness. */
export type AppDependencies = {
  config: Config;
  clock: Clock;
  random: Random;
  logger: Logger;
  alert: Alert;
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

export function createApp({ config, logger, alert }: AppDependencies) {
  const app = new Hono<AppEnv>().basePath('/api');

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
    // Public until auth exists; the session will be required from then on (spec stack §11).
    .post(
      '/client-errors',
      bodyLimit({ maxSize: CLIENT_ERROR_MAX_BYTES }),
      validator('json', (value, c) => {
        const report = clientErrorReport.safeParse(value);
        return report.success ? report.data : c.json({ error: 'invalid' }, 400);
      }),
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

  return routes;
}

export type AppType = ReturnType<typeof createApp>;
