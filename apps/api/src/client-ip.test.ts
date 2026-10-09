import { BlockList } from 'node:net';

import { expect, test } from 'vitest';

import { resolveClientIp } from './client-ip.ts';

const traefik = new BlockList();
traefik.addSubnet('172.18.0.0', 16, 'ipv4');

test('X-Forwarded-For is believed from the Traefik network only, last entry first', () => {
  expect(resolveClientIp('172.18.0.5', '10.9.9.9, 203.0.113.7', traefik)).toBe('203.0.113.7');
  expect(resolveClientIp('::ffff:172.18.0.5', '203.0.113.7', traefik)).toBe('203.0.113.7');
  expect(resolveClientIp('198.51.100.4', '203.0.113.7', traefik)).toBe('198.51.100.4');
  expect(resolveClientIp('172.18.0.5', 'not-an-ip', traefik)).toBe('172.18.0.5');
  expect(resolveClientIp('172.18.0.5', undefined, traefik)).toBe('172.18.0.5');
  expect(resolveClientIp(undefined, '203.0.113.7', traefik)).toBeUndefined();
});
