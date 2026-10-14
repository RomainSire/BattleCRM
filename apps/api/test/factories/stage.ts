import { eq } from 'drizzle-orm';

import { withUser } from '../../src/db/index.ts';
import { stage } from '../../src/funnel/index.ts';

/**
 * An archived Stage, written straight into the table of `funnel` until archiving has its gesture
 * (ticket 35): a state a User will reach, not one only a test can.
 */
export const archiveStage = (user: { userId: string }, stageId: string, now: Date) =>
  withUser(user.userId, (tx) =>
    tx.update(stage).set({ archivedAt: now }).where(eq(stage.id, stageId)),
  );
