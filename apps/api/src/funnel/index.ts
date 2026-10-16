import { m } from '@battlecrm/i18n';
import type { Locale } from '@battlecrm/i18n/runtime';
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';

import type { Transaction } from '../db/index.ts';
import { positioning, stage } from './tables.ts';

// Read by `views`, which never writes them.
export { positioning, positioningAttachment, stage } from './tables.ts';
export { createPositionings, type PositioningUses } from './positionings.ts';

/** The order of the Funnel, for every read of its Stages. */
export const FUNNEL_ORDER = [asc(stage.position), asc(stage.id)];

/** The Standard stages (spec UX §5.8), in their order: each a name and its Aim. */
const STANDARD_STAGES = [
  [m.standard_stage_outreach, m.standard_stage_outreach_aim],
  [m.standard_stage_agency_screening, m.standard_stage_agency_screening_aim],
  [m.standard_stage_client_screening, m.standard_stage_client_screening_aim],
  [m.standard_stage_closing, m.standard_stage_closing_aim],
] as const;

/**
 * The Funnel every User starts with, written when the account is created (ST-37): the Standard
 * stages in the language of the sign-up attempt, never translated afterwards.
 */
export async function initializeFunnel(
  tx: Transaction,
  newUser: { userId: string; locale: Locale },
): Promise<void> {
  const { userId, locale } = newUser;
  await tx.insert(stage).values(
    STANDARD_STAGES.map(([name, aim], position) => ({
      userId,
      name: name({}, { locale }),
      aim: aim({}, { locale }),
      position,
    })),
  );
}

/** The Stages of the Funnel of a User, archived ones left out, in their order (spec stack §5.2). */
export function stageOrder(tx: Transaction, userId: string) {
  return tx
    .select({ id: stage.id, name: stage.name })
    .from(stage)
    .where(and(eq(stage.userId, userId), isNull(stage.archivedAt)))
    .orderBy(...FUNNEL_ORDER);
}

/**
 * A Positioning of the User as its use reads it (spec UX §6.1), the row shared until the use is
 * written: deleting it then waits, and sees the use. `undefined` when the User has none by this id,
 * or only at an archived Stage.
 */
export async function positioningToUse(tx: Transaction, userId: string, positioningId: string) {
  const [found] = await tx
    .select({
      stageId: positioning.stageId,
      followUpDays: positioning.followUpDays,
      archived: isNotNull(positioning.archivedAt).mapWith(Boolean),
    })
    .from(positioning)
    .innerJoin(stage, and(eq(stage.userId, userId), eq(stage.id, positioning.stageId)))
    .where(
      and(
        eq(positioning.userId, userId),
        eq(positioning.id, positioningId),
        isNull(stage.archivedAt),
      ),
    )
    .for('share', { of: positioning });
  return found;
}
