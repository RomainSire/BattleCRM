import type { Logger } from 'pino';

import type { InFlight } from './in-flight.ts';

/** The only alert channel: a push monitor of uptime-kuma, which notifies through Pushover (spec stack §11). */
export type Alert = {
  /** Proof of life, sent by the scheduler. */
  up(): void;
  /** `reason` is built by `failureReason` or a fixed text: never user content. */
  down(reason: string): void;
};

/** Without UPTIME_KUMA_PUSH_URL (dev, tests), nothing is sent. */
export const noAlert: Alert = { up() {}, down() {} };

/** What an alert may say of an unexpected exception: its type and the route or job, never its message. */
export function failureReason(error: unknown, where: string): string {
  return `${error instanceof Error ? error.name : 'Error'} in ${where}`;
}

export function uptimeKumaAlert({
  pushUrl,
  logger,
  inFlight,
  fetch = globalThis.fetch,
}: {
  pushUrl: string;
  logger: Logger;
  inFlight: InFlight;
  fetch?: typeof globalThis.fetch;
}): Alert {
  // The push URL holds the monitor's token: a failure logs neither the URL nor the error, which may quote it.
  const failed = (fields: { error: string } | { status: number }) =>
    logger.warn(fields, 'alert ping failed');
  function ping(status: 'up' | 'down', msg: string) {
    const url = new URL(pushUrl);
    url.search = new URLSearchParams({ status, msg }).toString();
    inFlight.track(
      fetch(url, { signal: AbortSignal.timeout(5_000) }).then(
        (response) => {
          void response.body?.cancel();
          if (!response.ok) failed({ status: response.status });
        },
        (error: unknown) => failed({ error: error instanceof Error ? error.name : 'Error' }),
      ),
    );
  }
  return { up: () => ping('up', 'OK'), down: (reason) => ping('down', reason) };
}
