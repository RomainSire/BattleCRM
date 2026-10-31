import { describe, expect, test } from 'vitest';

import { testApp } from '../test/app.ts';
import { isOutdatedClient } from './client-version.ts';

describe('isOutdatedClient', () => {
  const minimum = '1.4.0';

  test('an extension older than the minimum is outdated, by each number in turn', () => {
    expect(isOutdatedClient('extension/1.3.9', minimum)).toBe(true);
    expect(isOutdatedClient('extension/0.9.0', minimum)).toBe(true);
    expect(isOutdatedClient('extension/1.3.10', minimum)).toBe(true);
  });

  test('the minimum and anything newer are not, numbers compared as numbers', () => {
    expect(isOutdatedClient('extension/1.4.0', minimum)).toBe(false);
    expect(isOutdatedClient('extension/1.10.0', minimum)).toBe(false);
    expect(isOutdatedClient('extension/2.0.0', minimum)).toBe(false);
  });

  test('an extension whose version cannot be read is outdated', () => {
    expect(isOutdatedClient('extension/', minimum)).toBe(true);
    expect(isOutdatedClient('extension/latest', minimum)).toBe(true);
    expect(isOutdatedClient('extension/1.4', minimum)).toBe(true);
  });

  test('without X-Client, or another client, nothing is checked', () => {
    expect(isOutdatedClient(undefined, minimum)).toBe(false);
    expect(isOutdatedClient('web/0.0.1', minimum)).toBe(false);
  });
});

describe('X-Client', () => {
  test('an extension below MIN_EXTENSION_VERSION answers 426, on any route, before anything else', async () => {
    const { app } = testApp();

    const response = await app.request('/api/health', {
      headers: { 'X-Client': 'extension/0.0.1' },
    });

    expect(response.status).toBe(426);
    expect(await response.json()).toEqual({ error: 'extension_outdated' });
  });

  test('a recent extension, and the SPA without X-Client, are served', async () => {
    const { app } = testApp();

    const recent = await app.request('/api/health', {
      headers: { 'X-Client': 'extension/999.0.0' },
    });
    const spa = await app.request('/api/health');

    expect(recent.status).toBe(200);
    expect(spa.status).toBe(200);
  });
});
