import { BlockList, isIP } from 'node:net';

import { z } from 'zod';

const subnets = z
  .string()
  .default('')
  .transform((value, ctx) => {
    const list = new BlockList();
    for (const subnet of value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)) {
      const [address = '', prefix] = subnet.split('/');
      const version = isIP(address);
      if (version === 0 || !prefix || !/^\d+$/.test(prefix)) {
        ctx.addIssue({
          code: 'custom',
          message: 'expected comma-separated subnets such as 172.18.0.0/16',
        });
        return z.NEVER;
      }
      list.addSubnet(address, Number(prefix), version === 4 ? 'ipv4' : 'ipv6');
    }
    return list;
  });

const apiEnv = z.object({
  /** The app role (ADR 0009): never the owner, never a superuser. */
  DATABASE_URL: z.url(),
  APP_VERSION: z.string().min(1),
  /** The origin of the SPA; the single list of trusted origins grows with the Firefox extension (spec stack §9). */
  APP_ORIGIN: z.url().transform((url) => new URL(url).origin),
  /** The Traefik network: the only peers whose X-Forwarded-For is believed. */
  TRUSTED_PROXIES: subnets,
  /** Signs the session cookie of Better Auth. */
  BETTER_AUTH_SECRET: z.string().min(32),
  /** Closed unless explicitly opened (ST-10); an attempt already started can still be verified. */
  SIGNUPS_OPEN: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** The Gmail account that sends the e-mails, with an app password (spec stack §8). */
  SMTP_USER: z.email(),
  SMTP_PASSWORD: z.string().min(1),
  EMAIL_FROM_NAME: z.preprocess((value) => value || undefined, z.string().default('BattleCRM')),
  /** The push monitor "BattleCRM API" of uptime-kuma (spec stack §11); without it, no alert is sent. */
  UPTIME_KUMA_PUSH_URL: z.preprocess((value) => value || undefined, z.url().optional()),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const migrationEnv = z.object({
  /** The owner role, known by the `migrate` entry point only. */
  MIGRATION_DATABASE_URL: z.url(),
});

export type Config = ReturnType<typeof loadConfig>;
type Env = Record<string, string | undefined>;

export function loadConfig(env: Env) {
  const parsed = parse(apiEnv, env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    appVersion: parsed.APP_VERSION,
    /** Links in e-mails are built on it. */
    appOrigin: parsed.APP_ORIGIN,
    trustedOrigins: [parsed.APP_ORIGIN],
    authSecret: parsed.BETTER_AUTH_SECRET,
    signupsOpen: parsed.SIGNUPS_OPEN,
    smtp: {
      user: parsed.SMTP_USER,
      password: parsed.SMTP_PASSWORD,
      fromName: parsed.EMAIL_FROM_NAME,
    },
    trustedProxies: parsed.TRUSTED_PROXIES,
    uptimeKumaPushUrl: parsed.UPTIME_KUMA_PUSH_URL,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
  };
}

export function loadMigrationConfig(env: Env) {
  return { databaseUrl: parse(migrationEnv, env).MIGRATION_DATABASE_URL };
}

/** Refuses to start on a missing or invalid variable; the message names it without echoing its value (a secret). */
function parse<Schema extends z.ZodType>(schema: Schema, env: Env): z.output<Schema> {
  const result = schema.safeParse(env, { reportInput: false });
  if (result.success) return result.data;
  const issues = result.error.issues.map((issue) => `- ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid configuration:\n${issues.join('\n')}`);
}
