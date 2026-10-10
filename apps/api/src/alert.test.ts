import { describe, expect, test } from 'vitest';

import { testLogger } from '../test/app.ts';
import { failureReason, uptimeKumaAlert } from './alert.ts';
import { createInFlight } from './in-flight.ts';

const pushUrl = 'https://kuma.example/api/push/s3cr3t-token?status=up&msg=OK&ping=';

function setup(
  answer: () => Promise<Response> = () => Promise.resolve(new Response('{"ok":true}')),
) {
  const requests: Request[] = [];
  const { logger, logs, output } = testLogger();
  const inFlight = createInFlight();
  const alert = uptimeKumaAlert({
    pushUrl,
    logger,
    inFlight,
    fetch: (input, init) => {
      requests.push(new Request(input, init));
      return answer();
    },
  });
  return { alert, requests, inFlight, logs, output };
}

describe('uptimeKumaAlert', () => {
  test('up pings the push monitor with status=up', () => {
    const { alert, requests } = setup();

    alert.up();

    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ['GET', 'https://kuma.example/api/push/s3cr3t-token?status=up&msg=OK'],
    ]);
  });

  test('down pings with status=down and the reason, without any body', () => {
    const { alert, requests } = setup();

    alert.down('TypeError in POST /api/contacts/:id');

    expect(requests).toHaveLength(1);
    const url = new URL(requests[0]!.url);
    expect(url.pathname).toBe('/api/push/s3cr3t-token');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      status: 'down',
      msg: 'TypeError in POST /api/contacts/:id',
    });
    expect(requests[0]!.body).toBeNull();
  });

  test('a ping is in flight until uptime-kuma answers', async () => {
    const answer = Promise.withResolvers<Response>();
    const { alert, inFlight } = setup(() => answer.promise);
    let settled = false;

    alert.up();
    void inFlight.settle(60_000).then(() => (settled = true));
    await new Promise((resolve) => setImmediate(resolve));
    expect(settled).toBe(false);

    answer.resolve(new Response('{"ok":true}'));
    await expect.poll(() => settled).toBe(true);
  });

  test('a failed or refused ping is logged without the push URL, and never throws', async () => {
    const unreachable = setup(() => Promise.reject(new TypeError(`fetch failed: ${pushUrl}`)));
    const refused = setup(() => Promise.resolve(new Response('nope', { status: 404 })));

    unreachable.alert.down('Error in job purge');
    refused.alert.up();
    await unreachable.inFlight.settle(1_000);
    await refused.inFlight.settle(1_000);

    expect(unreachable.logs()).toEqual([
      expect.objectContaining({ level: 40, msg: 'alert ping failed', error: 'TypeError' }),
    ]);
    expect(refused.logs()).toEqual([
      expect.objectContaining({ level: 40, msg: 'alert ping failed', status: 404 }),
    ]);
    expect(unreachable.output() + refused.output()).not.toContain('s3cr3t-token');
  });
});

describe('failureReason', () => {
  test('names the type of the error and where it happened, never its message', () => {
    expect(failureReason(new RangeError('note of Jane Doe'), 'job purge')).toBe(
      'RangeError in job purge',
    );
    expect(failureReason('a thrown string', 'GET /api/health')).toBe('Error in GET /api/health');
  });
});
