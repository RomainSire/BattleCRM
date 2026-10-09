import { expect, test } from 'vitest';

test('web tests run in a real browser', () => {
  expect(typeof window.matchMedia).toBe('function');
  expect(navigator.userAgent).toContain('Chrome');
});
