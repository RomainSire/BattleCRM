import { describe, expect, test } from 'vitest';

import { loadConfig, loadMigrationConfig } from './config.ts';

const env = {
  DATABASE_URL: 'postgres://battlecrm_app:secret@postgres:5432/battlecrm',
  APP_VERSION: '1.2.3',
  APP_ORIGIN: 'https://app.battlecrm.example',
  BETTER_AUTH_SECRET: 'a-secret-of-at-least-32-characters',
  SMTP_USER: 'sender@example.com',
  SMTP_PASSWORD: 'app-password',
};

describe('loadConfig', () => {
  test('reads a complete environment, with defaults for the optional variables', () => {
    const config = loadConfig(env);

    expect(config).toMatchObject({
      databaseUrl: env.DATABASE_URL,
      appVersion: '1.2.3',
      appOrigin: 'https://app.battlecrm.example',
      trustedOrigins: ['https://app.battlecrm.example'],
      signupsOpen: false,
      smtp: { user: 'sender@example.com', password: 'app-password', fromName: 'BattleCRM' },
      port: 3000,
      logLevel: 'info',
    });
    expect(config.trustedProxies.rules).toEqual([]);
  });

  test('refuses to start when a variable is missing, naming it without echoing any value', () => {
    const { DATABASE_URL: _, ...withoutDatabase } = env;

    expect(() => loadConfig({ ...withoutDatabase, APP_ORIGIN: 'not a url' })).toThrow(
      /Invalid configuration[\s\S]*DATABASE_URL[\s\S]*APP_ORIGIN/,
    );
    expect(() => loadConfig({ ...env, APP_ORIGIN: 'secret-looking-value' })).not.toThrow(
      /secret-looking-value/,
    );
  });

  test('keeps only the origin of APP_ORIGIN', () => {
    expect(
      loadConfig({ ...env, APP_ORIGIN: 'https://app.battlecrm.example/' }).trustedOrigins,
    ).toEqual(['https://app.battlecrm.example']);
  });

  test('reads TRUSTED_PROXIES as a list of subnets, and refuses an invalid one', () => {
    const { trustedProxies } = loadConfig({ ...env, TRUSTED_PROXIES: '172.18.0.0/16, fd00::/8' });

    expect(trustedProxies.check('172.18.4.2', 'ipv4')).toBe(true);
    expect(trustedProxies.check('fd00::1', 'ipv6')).toBe(true);
    expect(trustedProxies.check('10.0.0.1', 'ipv4')).toBe(false);
    expect(() => loadConfig({ ...env, TRUSTED_PROXIES: '172.18.0.0' })).toThrow(/TRUSTED_PROXIES/);
  });
});

describe('SIGNUPS_OPEN', () => {
  test('is closed unless it says true', () => {
    expect(loadConfig(env).signupsOpen).toBe(false);
    expect(loadConfig({ ...env, SIGNUPS_OPEN: 'false' }).signupsOpen).toBe(false);
    expect(loadConfig({ ...env, SIGNUPS_OPEN: 'true' }).signupsOpen).toBe(true);
    expect(() => loadConfig({ ...env, SIGNUPS_OPEN: 'yes' })).toThrow(/SIGNUPS_OPEN/);
  });
});

describe('auth and e-mail secrets', () => {
  test('are required, and a short session secret is refused without being echoed', () => {
    const { SMTP_PASSWORD: _, ...withoutPassword } = env;

    expect(() => loadConfig(withoutPassword)).toThrow(/SMTP_PASSWORD/);
    expect(() => loadConfig({ ...env, BETTER_AUTH_SECRET: 'too-short' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    expect(() => loadConfig({ ...env, BETTER_AUTH_SECRET: 'too-short' })).not.toThrow(/too-short/);
  });

  test('the sender name can be changed, and left empty means BattleCRM', () => {
    expect(loadConfig({ ...env, EMAIL_FROM_NAME: 'BattleCRM (dev)' }).smtp.fromName).toBe(
      'BattleCRM (dev)',
    );
    expect(loadConfig({ ...env, EMAIL_FROM_NAME: '' }).smtp.fromName).toBe('BattleCRM');
  });
});

describe('UPTIME_KUMA_PUSH_URL', () => {
  test('is optional: absent or left empty, there is no push URL', () => {
    expect(loadConfig(env).uptimeKumaPushUrl).toBeUndefined();
    expect(loadConfig({ ...env, UPTIME_KUMA_PUSH_URL: '' }).uptimeKumaPushUrl).toBeUndefined();
  });

  test('is read as a URL', () => {
    const url = 'https://kuma.example/api/push/token';

    expect(loadConfig({ ...env, UPTIME_KUMA_PUSH_URL: url }).uptimeKumaPushUrl).toBe(url);
    expect(() => loadConfig({ ...env, UPTIME_KUMA_PUSH_URL: 'kuma' })).toThrow(
      /UPTIME_KUMA_PUSH_URL/,
    );
  });
});

describe('loadMigrationConfig', () => {
  test('only needs the owner connection', () => {
    expect(
      loadMigrationConfig({ MIGRATION_DATABASE_URL: 'postgres://owner@postgres/battlecrm' }),
    ).toEqual({
      databaseUrl: 'postgres://owner@postgres/battlecrm',
    });
    expect(() => loadMigrationConfig({})).toThrow(/MIGRATION_DATABASE_URL/);
  });
});
