import {
  DEFAULT_BATTLE_HORIZON,
  DEFAULT_BATTLE_THRESHOLD,
  summaryChanges,
  type BattleTarget,
  type Verdict,
} from '@battlecrm/contract';
import { z } from 'zod';

import type { testApp } from '../app.ts';
import { postJson } from '../http.ts';
import {
  addContact,
  gestureAnswer,
  recordReply,
  revealAssignment,
  settleTrial,
  usePositioning,
} from './contact.ts';

type Harness = ReturnType<typeof testApp>;

/** What the wizard sends to open a Battle (spec UX §6.9), its Champion left out once the Stage has one. */
export type BattleFields = {
  stageId: string;
  championId?: string;
  challengerId: string;
  successCriterion: string;
  target: BattleTarget | null;
  threshold: number;
  horizon: number;
};

/** The defaults of the wizard: every Target, 85 %, an Horizon of 25. */
export const DEFAULT_BATTLE = {
  successCriterion: 'a répondu positivement',
  target: null,
  threshold: DEFAULT_BATTLE_THRESHOLD,
  horizon: DEFAULT_BATTLE_HORIZON,
} as const;

/** The request of an opening, as the wizard sends it. */
export const openBattleRequest = (
  harness: Harness,
  user: { cookie: string },
  fields: Partial<BattleFields> & Pick<BattleFields, 'stageId' | 'challengerId'>,
) => postJson(harness.app, '/api/battles', { ...DEFAULT_BATTLE, ...fields }, user.cookie);

/** A Battle opened the way a User opens one, and the token that takes it back. */
export async function openBattle(
  harness: Harness,
  user: { cookie: string },
  fields: Partial<BattleFields> & Pick<BattleFields, 'stageId' | 'challengerId'>,
) {
  const response = await openBattleRequest(harness, user, fields);
  if (response.status !== 201) throw new Error(`openBattle: the API answered ${response.status}`);
  const { changes, undoToken } = gestureAnswer.parse(await response.json());
  const [opened] = changes.battles;
  if (!opened) throw new Error('openBattle: no Battle in the answer');
  return { battle: opened, changes, undoToken };
}

/** What the closing window sends (spec UX §6.9): the Verdict, the designation acknowledged, the Takeaway. */
export type ClosingFields = { verdict: Verdict; designate?: boolean; takeaway?: string };

/** The request of a closing, as the closing window sends it. */
export const closeBattleRequest = (
  harness: Harness,
  user: { cookie: string },
  battleId: string,
  fields: ClosingFields,
) => postJson(harness.app, `/api/battles/${battleId}/close`, fields, user.cookie);

/** A Battle closed the way a User closes one, abandoned unless said otherwise. */
export async function closeBattle(
  harness: Harness,
  user: { cookie: string },
  battleId: string,
  fields: ClosingFields = { verdict: 'abandoned' },
) {
  const response = await closeBattleRequest(harness, user, battleId, fields);
  if (response.status !== 200) throw new Error(`closeBattle: the API answered ${response.status}`);
  return closed.parse(await response.json()).changes;
}

/** What a closing answers: the rows of the summary it changed, and no token, it is confirmed instead. */
export const closed = z.strictObject({ changes: summaryChanges });

/**
 * Trials of a Positioning in the open Battle of the first Stage, one new Contact each, sent on
 * 2026-01-05: `successes` replied, `noResults` settled without a reply, `inProgress` left as they are.
 * The Contacts, in that order.
 */
export async function playTrials(
  harness: Harness,
  user: { cookie: string },
  positioningId: string,
  { successes = 0, noResults = 0, inProgress = 0 },
) {
  const contacts = [];
  const outcomes = [
    ...Array<'success'>(successes).fill('success'),
    ...Array<'no_result'>(noResults).fill('no_result'),
    ...Array<'in_progress'>(inProgress).fill('in_progress'),
  ];
  for (const [index, outcome] of outcomes.entries()) {
    const { contact } = await addContact(
      harness,
      user,
      `Contact ${positioningId.slice(-4)} ${index}`,
      {
        status: 'prospecting',
      },
    );
    await revealAssignment(harness, user, contact.id);
    await usePositioning(harness, user, contact.id, { positioningId, occurredOn: '2026-01-05' });
    if (outcome === 'success') {
      await recordReply(harness, user, contact.id, {
        occurredOn: '2026-01-06',
        channel: 'email',
        trialOutcome: 'success',
      });
    } else if (outcome === 'no_result') {
      await settleTrial(harness, user, contact.id, { outcome: 'no_result' });
    }
    contacts.push(contact);
  }
  return contacts;
}
