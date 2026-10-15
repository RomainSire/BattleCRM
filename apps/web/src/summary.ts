import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import type { ApiClient } from './session.ts';

/** The working summary of the User (ADR 0012): what every screen computes from, without a round trip. */
export type Summary = InferResponseType<ApiClient['summary']['$get'], 200>;
export type SummaryContact = Summary['contacts'][number];
export type SummaryOrganization = Summary['organizations'][number];
export type SummaryPositioning = Summary['positionings'][number];
/** The rows of the summary a gesture changed, as its answer carries them. */
export type SummaryChanges = InferResponseType<ApiClient['contacts']['$post'], 201>['changes'];

export const SUMMARY_KEY = ['summary'];

/** What the record of a Contact reads beyond the summary, read on demand: its note and its thread. */
export const contactRecordKey = (contactId: string) => ['contact-record', contactId];

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

/** The Positionings of the User, the earliest first; none in a summary kept from before them. */
export function positioningsOf(summary: Summary): SummaryPositioning[] {
  const positionings: SummaryPositioning[] | undefined = summary.positionings;
  return positionings ?? [];
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
      },
  );
}
