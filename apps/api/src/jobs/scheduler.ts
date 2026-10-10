import type { Logger } from 'pino';

import { failureReason, type Alert } from '../alert.ts';

/** A scheduled task: idempotent SQL, so a test calls `run` directly and a restart may run it twice. */
export type Job = { name: string; run(): Promise<void> };

const UP_EVERY_MS = 5 * 60_000;
/** Jobs run every 15 minutes: one tick out of three. */
const JOBS_EVERY_TICKS = 3;

/** The in-process scheduler of the single API instance (spec stack §10.6). */
export function createScheduler({
  jobs,
  alert,
  logger,
}: {
  jobs: Job[];
  alert: Alert;
  logger: Logger;
}) {
  let timer: NodeJS.Timeout | undefined;
  let ticks = 0;
  let run: Promise<void> | undefined;

  /** Resolves to whether every job succeeded. */
  async function runJobs(): Promise<boolean> {
    let succeeded = true;
    for (const job of jobs) {
      try {
        await job.run();
      } catch (error) {
        succeeded = false;
        logger.error({ err: error, job: job.name }, 'job failed');
        alert.down(failureReason(error, `job ${job.name}`));
      }
    }
    return succeeded;
  }

  function tick() {
    const due = ticks % JOBS_EVERY_TICKS === 0;
    ticks += 1;
    // A run still going is never doubled, and sends no `up`: a job that hangs ends up alerting.
    if (run) return;
    if (!due) return alert.up();
    // `up` only after the jobs, and only if none failed: it would cover the `down` just sent.
    run = runJobs()
      .then((succeeded) => {
        if (succeeded) alert.up();
      })
      .finally(() => (run = undefined));
  }

  return {
    runJobs,
    start(): void {
      tick();
      timer = setInterval(tick, UP_EVERY_MS);
    },
    /** Resolves once the run in progress, if any, has ended: the database must outlive it. */
    async stop(): Promise<void> {
      clearInterval(timer);
      await run;
    },
  };
}
