import { expect, test } from 'vitest';

test('the API test process runs in UTC', () => {
  expect(new Date(0).getTimezoneOffset()).toBe(0);
  expect(process.env['TZ']).toBe('UTC');
});
