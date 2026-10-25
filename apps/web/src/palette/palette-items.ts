import type { ContactStatus } from '@battlecrm/contract';
import {
  canNoteInteraction,
  contactsMatching,
  daysBetween,
  hasFollowUps,
  normalizeName,
} from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';

import type {
  FollowUpGesture,
  InteractionGesture,
  SendGesture,
  StatusGesture,
} from '../contacts/status.ts';
import { STATUS_VERB } from '../contacts/status.ts';
import { organizationOf, type Summary, type SummaryContact } from '../summary.ts';
import { toHandleOf, type TodayRow } from '../today/to-handle.ts';
import type { Card } from '../funnel/next-action.tsx';

/** The gesture an action opens on the record of its Contact, kept by the address (ST-70). */
export type RecordSearch = {
  statusTo?: StatusGesture;
  stageTo?: 'choose';
  followUp?: FollowUpGesture;
  interaction?: InteractionGesture;
  send?: SendGesture;
};

/** An action on a Contact the palette offers (spec UX §3.3): on its record, or its Organization. */
export type ContactAction =
  | { id: string; verb: () => string; record: RecordSearch }
  | { id: 'organization'; verb: () => string; organizationId: string };

/** The way back to a Status, in the order of spec UX §3.3. */
const STATUS_ORDER: ContactStatus[] = ['prospecting', 'pool', 'ally', 'archived'];

/**
 * The actions of a Contact, filtered by its Status (spec UX §3.3), in the order of the spec: never the
 * verb of its current Status, Check in… on an Ally only.
 */
export function contactActionsOf(contact: SummaryContact, summary: Summary): ContactAction[] {
  const { status } = contact;
  const actions: ContactAction[] = [{ id: 'record', verb: m.palette_open_record, record: {} }];
  if (contact.followUp !== null) {
    actions.push({ id: 'follow-up', verb: m.verb_follow_up, record: { followUp: 'do' } });
  }
  actions.push(
    { id: 'reply', verb: m.verb_reply, record: { interaction: 'reply' } },
    { id: 'send', verb: m.verb_use_positioning, record: { send: 'positioning' } },
  );
  if (canNoteInteraction(status)) {
    actions.push({ id: 'note', verb: m.verb_note_interaction, record: { interaction: 'note' } });
  }
  if (status === 'ally') {
    actions.push({ id: 'check-in', verb: m.verb_check_in, record: { interaction: 'check-in' } });
  }
  if (hasFollowUps(status)) {
    actions.push({
      id: 'schedule',
      verb: contact.followUp ? m.verb_edit_follow_up : m.verb_schedule_follow_up,
      record: { followUp: 'schedule' },
    });
  }
  if (status === 'prospecting') {
    actions.push({ id: 'stage', verb: m.verb_change_stage, record: { stageTo: 'choose' } });
  }
  for (const target of STATUS_ORDER) {
    if (target === status) continue;
    actions.push({
      id: `status:${target}`,
      verb: STATUS_VERB[target],
      record: { statusTo: target },
    });
  }
  actions.push({ id: 'status:choose', verb: m.verb_change_status, record: { statusTo: 'choose' } });
  const organization = organizationOf(contact, summary);
  if (organization) {
    actions.push({
      id: 'organization',
      verb: m.palette_open_organization,
      organizationId: organization.id,
    });
  }
  return actions;
}

/** The words of a text, case and accents aside. */
const wordsOf = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '');

/** Whether what is typed is found in a label, case, accents and spaces aside. */
export const labelMatches = (typed: string, label: string) =>
  normalizeName(label).includes(normalizeName(typed));

/** The Contacts whose name, Organization, job title, e-mail or Stage holds what is typed, by name. */
export function contactsFound(typed: string, summary: Summary): SummaryContact[] {
  const byCoordinates = new Set(contactsMatching(typed, summary.contacts, summary.organizations));
  const wanted = normalizeName(typed);
  const stageNames = new Map(summary.stages.map(({ id, name }) => [id, normalizeName(name)]));
  return summary.contacts
    .filter(
      (contact) =>
        byCoordinates.has(contact) ||
        (contact.status === 'prospecting' &&
          contact.stageId !== null &&
          stageNames.get(contact.stageId)?.includes(wanted) === true),
    )
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

/** A word of a verb is enough: three letters at least, at the start of one of its words. */
const verbMatches = (word: string, verb: string) =>
  word.length >= 3 && wordsOf(verb).some((part) => part.startsWith(word));

/**
 * Verb first (spec UX §3.3): “relancer jul” offers Follow up… on Julie Martin. The first word typed
 * names the verb, a word of it is enough; the rest finds the Contacts that have it.
 */
export function verbFirst(
  typed: string,
  summary: Summary,
): { contact: SummaryContact; action: ContactAction }[] {
  const [first, ...rest] = typed.trim().split(/\s+/u);
  const name = rest.join(' ');
  if (first === undefined || name === '') return [];
  const [word] = wordsOf(first);
  if (word === undefined) return [];
  return contactsFound(name, summary).flatMap((contact) =>
    contactActionsOf(contact, summary)
      .filter((action) => verbMatches(word, action.verb()))
      .map((action) => ({ contact, action })),
  );
}

/** A Contact that needs action, or an Ally to check in with, and how overdue it is. */
export type NeedsAction = {
  row: TodayRow | { kind: 'window-elapsed'; card: Card };
  daysLate: number;
};

export const contactNeedingAction = ({ row }: NeedsAction) =>
  row.kind === 'ally' ? row.contact : row.card.contact;

/**
 * What the palette shows before anything is typed (spec UX §3.3): the Contacts to handle (Follow-ups
 * due or overdue, Trials past their window) and the Allies to check in with, the longest overdue first.
 */
export function needingActionOf(summary: Summary, today: string): NeedsAction[] {
  const { rows, windowElapsed } = toHandleOf(summary, today);
  return [
    ...rows.map((row) => ({ row, daysLate: row.daysLate })),
    ...windowElapsed.map((card) => ({
      row: { kind: 'window-elapsed' as const, card },
      daysLate: 'on' in card.agenda ? daysBetween(card.agenda.on, today) : 0,
    })),
  ].toSorted(
    (a, b) =>
      b.daysLate - a.daysLate ||
      contactNeedingAction(a).name.localeCompare(contactNeedingAction(b).name),
  );
}
