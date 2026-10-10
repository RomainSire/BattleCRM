import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createInFlight } from './in-flight.ts';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function watch(promise: Promise<void>) {
  const state = { done: false };
  void promise.then(() => (state.done = true));
  return state;
}

test('settles as soon as every tracked send has ended, a failed one included', async () => {
  const inFlight = createInFlight();
  const sent = Promise.withResolvers<void>();
  const failed = Promise.withResolvers<void>();
  inFlight.track(sent.promise);
  inFlight.track(failed.promise);
  const settled = watch(inFlight.settle(5_000));

  sent.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(settled.done).toBe(false);

  failed.reject(new Error('smtp down'));
  await vi.advanceTimersByTimeAsync(0);
  expect(settled.done).toBe(true);
});

test('stops waiting after the timeout when a send hangs', async () => {
  const inFlight = createInFlight();
  inFlight.track(new Promise(() => {}));
  const settled = watch(inFlight.settle(5_000));

  await vi.advanceTimersByTimeAsync(4_999);
  expect(settled.done).toBe(false);

  await vi.advanceTimersByTimeAsync(1);
  expect(settled.done).toBe(true);
});

test('settles at once when nothing is in flight', async () => {
  const settled = watch(createInFlight().settle(5_000));

  await vi.advanceTimersByTimeAsync(0);

  expect(settled.done).toBe(true);
});
