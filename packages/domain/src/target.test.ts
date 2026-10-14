import { expect, test } from 'vitest';

import { targetOf } from './target.ts';

test('the Target of a Contact follows the type of its Organization, unknown without one', () => {
  expect(targetOf({ type: 'consultancy' })).toBe('consultancy');
  expect(targetOf({ type: 'end_client' })).toBe('end_client');
  expect(targetOf(undefined)).toBe('unknown');
});
