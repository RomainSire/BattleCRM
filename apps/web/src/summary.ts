import type {
  Summary,
  SummaryBattle,
  SummaryChanges,
  SummaryContact,
  SummaryPositioning,
} from '@battlecrm/contract';
import {
  evaluateWinRule,
  localDay,
  titleHolderAfter,
  type Verdict,
  type WinRule,
  type WinRuleCounts,
} from '@battlecrm/domain';
import { queryOptions, type QueryClient } from '@tanstack/react-query';

import type { ApiClient } from './session.ts';

// The working summary of the User (ADR 0012), what every screen computes from without a round trip,
// and the rows of it a gesture changed: as the contract describes them.
export type {
  Summary,
  SummaryBattle,
  SummaryChanges,
  SummaryContact,
  SummaryOrganization,
  SummaryPositioning,
  SummarySettings,
} from '@battlecrm/contract';

export const SUMMARY_KEY = ['summary'];

/** What the record of a Contact reads beyond the summary, read on demand: its note and its thread. */
export const contactRecordKey = (contactId: string) => ['contact-record', contactId];

/** What the panel of a Battle reads beyond the summary, on demand: its Trials. */
export const battleTrialsKey = (battleId: string) => ['battle-trials', battleId];

/** Read once for the whole app, kept on the device (device-data.ts), then updated by each gesture. */
export const summaryQuery = (api: ApiClient) =>
  queryOptions({
    queryKey: SUMMARY_KEY,
    queryFn: async (): Promise<Summary> => {
      const response = await api.summary.$get();
      if (!response.ok) throw new Error('GET /api/summary failed');
      return response.json();
    },
    // What the device kept stays readable for as long as nothing fresher came (ADR 0004).
    gcTime: Infinity,
    retry: false,
  });

/** The time zone of the User in effect now. */
export function timeZoneOf(summary: Summary | undefined): string {
  // Fallback: while the summary is read, or in a summary kept on the device by a version from
  // before the time zone, this device's.
  const timeZone: string | undefined = summary?.timeZone;
  return timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Today for the User, in its time zone: what a Follow-up is due on, the Activity and the Funnel entries counted on. */
export const todayOf = (summary: Summary) => localDay(new Date(), timeZoneOf(summary));

/** The Positionings of the User, the earliest first. */
export function positioningsOf(summary: Summary): SummaryPositioning[] {
  // Fallback: a summary kept on the device by a version from before Positionings carries none.
  const positionings: SummaryPositioning[] | undefined = summary.positionings;
  return positionings ?? [];
}

/** The Battles of the User, open or closed, the earliest first. */
export function battlesOf(summary: Summary): SummaryBattle[] {
  // Fallback: a summary kept on the device by a version from before Battles carries none.
  const battles: SummaryBattle[] | undefined = summary.battles;
  return battles ?? [];
}

/** The open Battle of a Stage, if it has one: at most one (CONTEXT.md, Battle). */
export const openBattleAt = (summary: Summary, stageId: string) =>
  battlesOf(summary).find((battle) => battle.stageId === stageId && battle.open);

/** No Trial on either side. */
const NO_TRIALS: WinRuleCounts = {
  champion: { successes: 0, noResults: 0, inProgress: 0 },
  challenger: { successes: 0, noResults: 0, inProgress: 0 },
};

/** Where a Battle stands by the Win rule (ADR 0001), computed as the API would (ADR 0012). */
export function winRuleOf(battle: SummaryBattle): WinRule {
  return evaluateWinRule(trialCountsOf(battle), battle.threshold, battle.horizon);
}

/** The Trials of a Battle per Positioning, the canceled ones aside. */
export function trialCountsOf(battle: SummaryBattle): WinRuleCounts {
  // Fallback: a summary kept on the device by a version from before the counts carries none.
  const trials: WinRuleCounts | undefined = battle.trials;
  return trials ?? NO_TRIALS;
}

/** Whether an open Battle is conclusive: the dot on the Battles entry (spec UX §3.1). */
export const hasConclusiveBattle = (summary: Summary) =>
  battlesOf(summary).some((battle) => battle.open && winRuleOf(battle).state === 'conclusive');

/** The last Battle of a Stage, open or closed, if it had one. */
export const lastBattleAt = (summary: Summary, stageId: string) =>
  battlesOf(summary).findLast((battle) => battle.stageId === stageId);

/** The Verdict of a closed Battle, `null` while it is open. */
export function verdictOf(battle: SummaryBattle): Verdict | null {
  // Fallback: a summary kept on the device by a version from before closing carries none.
  const verdict: Verdict | null | undefined = battle.verdict;
  return verdict ?? null;
}

/** Who holds the title of a Battle: its Champion while open, the winner of its Verdict once closed. */
export function titleHolderOf(battle: SummaryBattle) {
  const verdict = verdictOf(battle);
  return verdict !== null && titleHolderAfter(verdict) === 'challenger'
    ? battle.challengerId
    : battle.championId;
}

/**
 * The Champion of a Stage (CONTEXT.md): the winner of its last Battle, or the Champion it defends
 * while open, the initial Champion before the second; `undefined` before its first.
 */
export function championAt(summary: Summary, stageId: string): SummaryPositioning | undefined {
  const last = lastBattleAt(summary, stageId);
  const championId = last && titleHolderOf(last);
  return positioningsOf(summary).find(({ id }) => id === championId);
}

/**
 * Where a Positioning stands in the Battles (spec UX §5.6): the Champion of its Stage, the Challenger
 * of its open Battle, and whether it ever served in one.
 */
export function battleStandingOf(summary: Summary, positioning: SummaryPositioning) {
  const open = openBattleAt(summary, positioning.stageId);
  const isChampion = championAt(summary, positioning.stageId)?.id === positioning.id;
  return {
    isChampion,
    isChallenger: open?.challengerId === positioning.id,
    inOpenBattle:
      open !== undefined &&
      (open.championId === positioning.id || open.challengerId === positioning.id),
    inAnyBattle: battlesOf(summary).some(
      ({ championId, challengerId }) =>
        championId === positioning.id || challengerId === positioning.id,
    ),
  };
}

/** The Trial in progress of a Contact, if it has one. */
export function trialOf(contact: SummaryContact): SummaryContact['trial'] {
  // Fallback: a summary kept on the device by a version from before Trials carries none.
  const trial: SummaryContact['trial'] | undefined = contact.trial;
  return trial ?? null;
}

/** The Organization of a Contact, if it has one. */
export const organizationOf = (contact: SummaryContact, summary: Summary) =>
  summary.organizations.find(({ id }) => id === contact.organizationId);

/** The local day a Contact reached its Stage, `null` at none or while the summary does not say. */
export function stageEnteredOnOf(contact: SummaryContact): string | null {
  // Fallback: a summary kept on the device by a version from before this day carries none.
  const day: string | null | undefined = contact.stageEnteredOn;
  return day ?? null;
}

/** Frozen from its first Trial (CONTEXT.md, Positioning). */
export const isFrozen = ({ trialCount }: SummaryPositioning) => trialCount > 0;

/** The attachments of a Positioning. */
export function attachmentsOf(positioning: SummaryPositioning): SummaryPositioning['attachments'] {
  // Fallback: a summary kept on the device by a version from before attachments carries none.
  const attachments: SummaryPositioning['attachments'] | undefined = positioning.attachments;
  return attachments ?? [];
}

/**
 * Puts the rows a gesture answered with into the summary, instead of reading it all again; the
 * records of the Contacts it changed, beyond the summary, are read again when shown.
 */
export async function applySummaryChanges(
  queryClient: QueryClient,
  changes: SummaryChanges,
): Promise<void> {
  for (const { id } of changes.contacts) {
    void queryClient.invalidateQueries({ queryKey: contactRecordKey(id) });
  }
  // Fallback: an answer from a version from before Battles carries none.
  const battlesChanged: SummaryBattle[] | undefined = changes.battles;
  for (const { id } of battlesChanged ?? []) {
    void queryClient.invalidateQueries({ queryKey: battleTrialsKey(id) });
  }
  // A read under way started before the gesture: its answer must not overwrite these rows.
  await queryClient.cancelQueries({ queryKey: SUMMARY_KEY });
  if (queryClient.getQueryData(SUMMARY_KEY) === undefined) {
    await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
    return;
  }
  const replacedContacts = new Set([
    ...changes.removedContactIds,
    ...changes.contacts.map((contact) => contact.id),
  ]);
  const replacedOrganizations = new Set([
    ...changes.removedOrganizationIds,
    ...changes.organizations.map((organization) => organization.id),
  ]);
  const replacedPositionings = new Set([
    ...changes.removedPositioningIds,
    ...changes.positionings.map((positioning) => positioning.id),
  ]);
  // Fallback: an answer from a version from before Battles carries none.
  const answeredBattles: SummaryBattle[] | undefined = changes.battles;
  const answeredRemovals: string[] | undefined = changes.removedBattleIds;
  const changedBattles = answeredBattles ?? [];
  const replacedBattles = new Set([
    ...(answeredRemovals ?? []),
    ...changedBattles.map(({ id }) => id),
  ]);
  queryClient.setQueryData<Summary>(
    SUMMARY_KEY,
    (summary) =>
      summary && {
        ...summary,
        contacts: [
          ...changes.contacts,
          ...summary.contacts.filter((contact) => !replacedContacts.has(contact.id)),
        ],
        organizations: [
          ...changes.organizations,
          ...summary.organizations.filter(
            (organization) => !replacedOrganizations.has(organization.id),
          ),
        ],
        // The earliest first, as the summary reads them (uuidv7): a copy after its original.
        positionings: [
          ...changes.positionings,
          ...positioningsOf(summary).filter(
            (positioning) => !replacedPositionings.has(positioning.id),
          ),
        ].toSorted((a, b) => a.id.localeCompare(b.id)),
        // The earliest first, as the summary reads them (uuidv7).
        battles: [
          ...changedBattles,
          ...battlesOf(summary).filter((battle) => !replacedBattles.has(battle.id)),
        ].toSorted((a, b) => a.id.localeCompare(b.id)),
      },
  );
}
