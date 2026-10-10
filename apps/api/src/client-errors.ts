import { z } from 'zod';

/** What the SPA reports of an uncaught error (spec stack §11): logged, never stored. */
export const clientErrorReport = z.object({
  message: z.string().max(2_000),
  stack: z.string().max(20_000).optional(),
  /** The version of the SPA, which may be older than the API's. */
  version: z.string().max(50),
});

/** Above the longest valid report, whose characters may each take several bytes once encoded. */
export const CLIENT_ERROR_MAX_BYTES = 128 * 1024;
