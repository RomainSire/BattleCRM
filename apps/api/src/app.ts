import { randomUUID } from 'node:crypto';

import type { HttpBindings } from '@hono/node-server';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { routePath } from 'hono/route';
import { secureHeaders } from 'hono/secure-headers';
import type { Logger } from 'pino';

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

export function createApp({ config, logger }: AppDependencies) {
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
  const routes = app.get('/health', async (c) =>
    (await isDatabaseReady())
      ? c.json({ status: 'ok', version: config.appVersion })
      : c.json({ status: 'unavailable', version: config.appVersion }, 503),
  );

  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    logger.error({ err: error, requestId: c.var.requestId }, 'unexpected error');
    return c.json({ error: 'internal' }, 500);
  });

  return routes;
}

export type AppType = ReturnType<typeof createApp>;
