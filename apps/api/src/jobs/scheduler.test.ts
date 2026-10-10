import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { testLogger } from '../../test/app.ts';
import { recordingAlert } from '../../test/doubles.ts';
import { createScheduler, type Job } from './index.ts';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function countingJob(name: string): Job & { runs: number } {
  const job = {
    name,
    runs: 0,
    run: () => {
      job.runs += 1;
      return Promise.resolve();
    },
  };
  return job;
}

function setup(...jobs: Job[]) {
  const alert = recordingAlert();
  const { logger, logs } = testLogger();
  const scheduler = createScheduler({ jobs, alert, logger });
  return { scheduler, alert, logs };
}

test('the loop runs every registered job at start, then every 15 minutes', async () => {
  const purge = countingJob('purge');
  const cleanup = countingJob('cleanup');
  const { scheduler } = setup(purge, cleanup);

  scheduler.start();
  await vi.advanceTimersByTimeAsync(0);
  expect([purge.runs, cleanup.runs]).toEqual([1, 1]);

  await vi.advanceTimersByTimeAsync(14 * 60_000);
  expect([purge.runs, cleanup.runs]).toEqual([1, 1]);

  await vi.advanceTimersByTimeAsync(60_000);
  expect([purge.runs, cleanup.runs]).toEqual([2, 2]);

  await scheduler.stop();
});

test('the loop tells the alert it is up at start, then every 5 minutes', async () => {
  const { scheduler, alert } = setup();

  scheduler.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(alert.ups).toBe(1);

  await vi.advanceTimersByTimeAsync(15 * 60_000);
  expect(alert.ups).toBe(4);
  expect(alert.downs).toEqual([]);

  await scheduler.stop();
});

test('a failing job is logged and alerted by its name, and the next jobs still run', async () => {
  const failing: Job = {
    name: 'purge',
    run: () => Promise.reject(new RangeError('row of jane@example.com')),
  };
  const cleanup = countingJob('cleanup');
  const { scheduler, alert, logs } = setup(failing, cleanup);

  scheduler.start();
  await vi.advanceTimersByTimeAsync(0);

  expect(cleanup.runs).toBe(1);
  expect(alert.downs).toEqual(['RangeError in job purge']);
  // No `up` in the same tick, which would cover the alert; the next tick brings it back.
  expect(alert.ups).toBe(0);
  await vi.advanceTimersByTimeAsync(5 * 60_000);
  expect(alert.ups).toBe(1);
  await scheduler.stop();
  expect(logs()).toEqual([expect.objectContaining({ level: 50, msg: 'job failed', job: 'purge' })]);
});

test('a run still going when the next one is due is not started twice, and stops the up pings', async () => {
  const slow = Promise.withResolvers<void>();
  let starts = 0;
  const { scheduler, alert } = setup({
    name: 'slow',
    run: () => {
      starts += 1;
      return slow.promise;
    },
  });

  scheduler.start();
  await vi.advanceTimersByTimeAsync(30 * 60_000);
  expect(starts).toBe(1);
  expect(alert.ups).toBe(0);

  slow.resolve();
  await vi.advanceTimersByTimeAsync(15 * 60_000);
  expect(starts).toBe(2);

  await scheduler.stop();
});

test('stopping waits for the run in progress', async () => {
  const slow = Promise.withResolvers<void>();
  const { scheduler } = setup({ name: 'slow', run: () => slow.promise });
  let stopped = false;

  scheduler.start();
  void scheduler.stop().then(() => (stopped = true));
  await vi.advanceTimersByTimeAsync(0);
  expect(stopped).toBe(false);

  slow.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(stopped).toBe(true);
});

test('once stopped, the loop neither runs jobs nor pings', async () => {
  const purge = countingJob('purge');
  const { scheduler, alert } = setup(purge);

  scheduler.start();
  await vi.advanceTimersByTimeAsync(0);
  await scheduler.stop();
  await vi.advanceTimersByTimeAsync(60 * 60_000);

  expect(purge.runs).toBe(1);
  expect(alert.ups).toBe(1);
});
