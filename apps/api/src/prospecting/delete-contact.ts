import { m } from '@battlecrm/i18n';
import { and, eq } from 'drizzle-orm';

import type { Transaction } from '../db/index.ts';
import { forgetGesturesOn, touched, type Touched } from '../gestures/index.ts';
import { settingsOf } from '../settings/index.ts';
import { contact, followUp, interaction, statusChange, trial } from './tables.ts';
import { dropAssignment, settleTrial } from './trials.ts';

/**
 * Deletes a Contact, already locked (ADR 0006, spec UX §6.13): anonymized in place, for good. What
 * identifies it is erased, the notes of its Interactions and Follow-ups, the reasons written about it;
 * its Trials and Interactions stay, so Battles, the Activity and pass rates do not change. Its Trial
 * in progress is canceled (“Contact deleted”), its scheduled Follow-up canceled, its Assignment falls,
 * and nothing it did can be undone any more. Archived, it is out of every read by Status. The rows of
 * the summary it changed.
 */
export async function anonymizeContact(
  tx: Transaction,
  userId: string,
  contactId: string,
  now: Date,
): Promise<Touched> {
  const { locale } = await settingsOf(tx, userId, now);
  // Its Battles show it under “Contact deleted” from now on.
  const tried = await tx
    .selectDistinct({ battleId: trial.battleId })
    .from(trial)
    .where(and(eq(trial.userId, userId), eq(trial.contactId, contactId)));
  await settleTrial(
    tx,
    userId,
    contactId,
    { outcome: 'canceled', cancelReason: m.trial_cancel_reason_contact_deleted({}, { locale }) },
    now,
  );
  await dropAssignment(tx, userId, contactId);
  await tx
    .update(followUp)
    .set({ status: 'canceled' })
    .where(
      and(
        eq(followUp.userId, userId),
        eq(followUp.contactId, contactId),
        eq(followUp.status, 'scheduled'),
      ),
    );
  await tx
    .update(followUp)
    .set({ note: null })
    .where(and(eq(followUp.userId, userId), eq(followUp.contactId, contactId)));
  await tx
    .update(interaction)
    .set({ note: null })
    .where(and(eq(interaction.userId, userId), eq(interaction.contactId, contactId)));
  await tx
    .update(statusChange)
    .set({ reason: null })
    .where(and(eq(statusChange.userId, userId), eq(statusChange.contactId, contactId)));
  await tx
    .update(trial)
    .set({ overrideReason: null })
    .where(and(eq(trial.userId, userId), eq(trial.contactId, contactId)));
  // What “Undo” kept of its gestures, its Coordinates before an edit among them.
  await forgetGesturesOn(tx, userId, contactId);
  await tx
    .update(contact)
    .set({
      name: null,
      jobTitle: null,
      email: null,
      phone: null,
      linkedinUrl: null,
      note: null,
      organizationId: null,
      status: 'archived',
      anonymizedAt: now,
    })
    .where(and(eq(contact.userId, userId), eq(contact.id, contactId)));
  return touched({
    removedContactIds: [contactId],
    battleIds: tried.map(({ battleId }) => battleId),
    deletedContacts: true,
  });
}
