import {
  DEFAULT_BATTLE_HORIZON,
  DEFAULT_BATTLE_THRESHOLD,
  type BattleTarget,
} from '@battlecrm/contract';
import { eq } from 'drizzle-orm';

import { battle } from '../../src/battles/index.ts';
import { withUser } from '../../src/db/index.ts';
import type { testApp } from '../app.ts';
import { postJson } from '../http.ts';
import { gestureAnswer } from './contact.ts';

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

/**
 * A Battle closed, written straight into the table of `battles` until closing has its gesture
 * (ticket 32): a state a User will reach, not one only a test can.
 */
export const closeBattle = (user: { userId: string }, battleId: string, now: Date) =>
  withUser(user.userId, (tx) =>
    tx.update(battle).set({ closedAt: now }).where(eq(battle.id, battleId)),
  );
