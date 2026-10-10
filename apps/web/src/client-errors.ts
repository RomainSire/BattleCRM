import type { createApiClient } from './api-client.ts';

/** Per page load: an error thrown at every render must not flood the API. */
const MAX_REPORTS = 5;

/** Sends an uncaught error of the SPA to the API, which logs it and alerts (spec stack §11). */
export function createClientErrorReporter(
  api: ReturnType<typeof createApiClient>,
  version: string,
) {
  let reports = 0;
  return (error: unknown): void => {
    if (reports >= MAX_REPORTS) return;
    reports += 1;
    const json = {
      // The limits of the API, which refuses a longer report.
      message: String(error).slice(0, 2_000),
      stack: error instanceof Error ? error.stack?.slice(0, 20_000) : undefined,
      version,
    };
    // A failed report is dropped: reporting it would loop, and offline there is nobody to tell.
    api['client-errors'].$post({ json }).catch(() => {});
  };
}

/** Everything the page did not catch: errors thrown outside React, and promises rejected without a handler. */
export function reportUncaughtErrors(
  report: (error: unknown) => void,
  page: EventTarget = window,
): void {
  page.addEventListener('error', (event) => {
    if (event instanceof ErrorEvent) report(event.error ?? event.message);
  });
  page.addEventListener('unhandledrejection', (event) => {
    if (event instanceof PromiseRejectionEvent) report(event.reason);
  });
}
