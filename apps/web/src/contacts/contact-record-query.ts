import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import type { ApiClient } from '../session.ts';
import { contactRecordKey } from '../summary.ts';

/** What the record of a Contact reads beyond the summary: its note and its thread. */
export type ContactRecord = InferResponseType<ApiClient['contacts'][':id']['record']['$get'], 200>;
export type ThreadEntry = ContactRecord['thread'][number];

/** Read on demand, when a record opens (spec stack §3); never kept on the device. */
export const contactRecordQuery = (api: ApiClient, contactId: string) =>
  queryOptions({
    queryKey: contactRecordKey(contactId),
    queryFn: async (): Promise<ContactRecord> => {
      const response = await api.contacts[':id'].record.$get({ param: { id: contactId } });
      if (!response.ok) throw new Error('GET /api/contacts/:id/record failed');
      return response.json();
    },
    retry: false,
  });
