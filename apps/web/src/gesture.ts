import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { notify } from './components/ui/toast.tsx';
import { applySummaryChanges, SUMMARY_KEY, type Summary, type SummaryChanges } from './summary.ts';
import { celebrateIfReached, originOf } from './today/celebration.tsx';
import { notifyGesture } from './undo.tsx';

/**
 * What a gesture answers once done: the rows of the summary it changed, and its token when it can be
 * undone (ADR 0011). Without a token, it never is (spec UX §1).
 */
type Done = { changes: SummaryChanges; undoToken?: string };

/** The answer of a gesture's route, as the typed client gives it: done, or refused with a code. */
type GestureAnswer = { ok: boolean; status: number; json(): Promise<Done | { error: string }> };

/** The statuses a refusal answers with (`REFUSAL_STATUS`, apps/api/src/refusals.ts); any other is a failure. */
const REFUSAL_STATUSES = new Set([400, 404, 409, 413]);

/**
 * The refusals a gesture's route answers with, typed from the API: a code renamed on the server
 * breaks the screen that reacts to it. Never `invalid`: a body the server would not read is this
 * app's error, never the User's.
 */
export type RefusalOf<Send extends (...args: never) => Promise<GestureAnswer>> = Exclude<
  Extract<Awaited<ReturnType<Awaited<ReturnType<Send>>['json']>>, { error: string }>,
  { error: 'invalid' }
>;

/**
 * Sends a gesture (ADR 0011, 0012). Done, its rows go into the summary and `message`, when it says
 * something, is shown, with “Undo” when the gesture has a token; the Activity goal it reached is
 * celebrated (spec UX §2). Refused, the summary is read again (this device may be behind)
 * and the refusal is returned, for the screen to react to. Anything else throws.
 */
export async function sendGesture<Answer extends GestureAnswer>(
  queryClient: QueryClient,
  request: Promise<Answer>,
  message: (changes: SummaryChanges) => string | undefined,
): Promise<RefusalOf<() => Promise<Answer>> | undefined> {
  // The control the gesture was sent with, before its panel closes: where a celebration starts.
  const origin = originOf(document.activeElement);
  const response = await request;
  if (!response.ok && !REFUSAL_STATUSES.has(response.status)) {
    throw new Error(`A gesture failed with ${response.status}`);
  }
  const answer = await response.json();
  if ('error' in answer) {
    if (answer.error === 'invalid') throw new Error('A gesture was refused as invalid');
    await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    // The body of a refusal, whose code the type of the answer narrows.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return answer as RefusalOf<() => Promise<Answer>>;
  }
  const before = queryClient.getQueryData<Summary>(SUMMARY_KEY);
  await applySummaryChanges(queryClient, answer.changes);
  celebrateIfReached(before, queryClient.getQueryData<Summary>(SUMMARY_KEY), origin);
  const said = message(answer.changes);
  if (said === undefined) return undefined;
  if (answer.undoToken === undefined) notify({ message: said });
  else notifyGesture(said, answer.undoToken);
  return undefined;
}

/** `sendGesture`, on the query client of the app. */
export function useSendGesture() {
  const queryClient = useQueryClient();
  return <Answer extends GestureAnswer>(
    request: Promise<Answer>,
    message: (changes: SummaryChanges) => string | undefined,
  ) => sendGesture(queryClient, request, message);
}
