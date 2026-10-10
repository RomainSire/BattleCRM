import { expect, test } from 'vitest';

import { createApiClient } from './api-client.ts';
import { createClientErrorReporter, reportUncaughtErrors } from './client-errors.ts';

function setup(answer: () => Promise<Response> = () => Promise.resolve(new Response(null))) {
  const sent: { url: string; body: unknown }[] = [];
  const api = createApiClient(async (input, init) => {
    const request = new Request(input, init);
    sent.push({ url: request.url, body: await request.json() });
    return answer();
  });
  const report = createClientErrorReporter(api, '1.2.3');
  return { report, sent };
}

test('sends the message, the stack and the version of the SPA to the API', async () => {
  const { report, sent } = setup();
  const error = new TypeError('x is undefined');

  report(error);

  await expect.poll(() => sent).toHaveLength(1);
  expect(sent[0]).toEqual({
    url: `${location.origin}/api/client-errors`,
    body: { message: 'TypeError: x is undefined', stack: error.stack, version: '1.2.3' },
  });
});

test('reports what is thrown even when it is not an Error', async () => {
  const { report, sent } = setup();

  report('plain string');

  await expect.poll(() => sent).toHaveLength(1);
  expect(sent[0]?.body).toEqual({ message: 'plain string', version: '1.2.3' });
});

test('truncates what the API would refuse', async () => {
  const { report, sent } = setup();
  const error = new Error('m'.repeat(5_000));
  error.stack = 's'.repeat(50_000);

  report(error);

  await expect.poll(() => sent).toHaveLength(1);
  expect(sent[0]?.body).toEqual({
    message: `Error: ${'m'.repeat(1_993)}`,
    stack: 's'.repeat(20_000),
    version: '1.2.3',
  });
});

test('an error loop sends a handful of reports, not a flood', async () => {
  const { report, sent } = setup();

  for (let i = 0; i < 50; i++) report(new Error(`render ${i}`));

  await expect.poll(() => sent).toHaveLength(5);
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(sent).toHaveLength(5);
});

test('a report that cannot be sent is dropped silently', async () => {
  const offline = setup(() => Promise.reject(new TypeError('Failed to fetch')));

  offline.report(new Error('boom'));

  await expect.poll(() => offline.sent).toHaveLength(1);
});

test('uncaught errors and unhandled rejections of the page are reported', () => {
  const page = new EventTarget();
  const reported: unknown[] = [];
  reportUncaughtErrors((error) => reported.push(error), page);
  const thrown = new Error('thrown in a handler');
  const rejected = new Error('rejected promise');

  page.dispatchEvent(new ErrorEvent('error', { error: thrown, message: thrown.message }));
  page.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));
  page.dispatchEvent(
    new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: rejected,
    }),
  );

  expect(reported).toEqual([thrown, 'Script error.', rejected]);
});
