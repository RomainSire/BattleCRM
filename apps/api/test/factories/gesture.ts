import { summaryChanges } from '@battlecrm/contract';
import { z } from 'zod';

import type { testApp } from '../app.ts';
import { postJson } from '../http.ts';

type Harness = ReturnType<typeof testApp>;

/** “Undo”, as the toast sends it with the token of a gesture. */
export const undo = (harness: Harness, user: { cookie: string }, undoToken: string) =>
  postJson(harness.app, `/api/gestures/${undoToken}/undo`, {}, user.cookie);

/** What “Undo” answers: the rows of the summary it changed. */
export const undone = z.object({ changes: summaryChanges });
