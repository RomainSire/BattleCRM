import { QueryClient } from '@tanstack/react-query';
import { afterEach, expect, test } from 'vitest';

import { changes, contact, organization, summary } from '../test/summary.ts';
import { createApiClient } from './api-client.ts';
import { toasts } from './components/ui/toast.tsx';
import { sendGesture } from './gesture.ts';
import { SUMMARY_KEY, type Summary } from './summary.ts';

const CONTACT_ID = '01990000-0000-7000-8000-000000000001';
const ORGANIZATION_ID = '01990000-0000-7000-8000-000000000002';

/** A summary of one Contact named “Before”, read by the device. */
function setUp(answer: () => Response) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    SUMMARY_KEY,
    summary({ contacts: [contact({ id: CONTACT_ID, name: 'Before' })] }),
  );
  const api = createApiClient(() => Promise.resolve(answer()));
  const cancel = () => api.contacts[':id']['cancel-follow-up'].$post({ param: { id: CONTACT_ID } });
  return { queryClient, cancel };
}

const contactsOf = (queryClient: QueryClient) =>
  queryClient.getQueryData<Summary>(SUMMARY_KEY)?.contacts.map(({ name }) => name);

const shownToasts = () => toasts.visibleToasts.map(({ content }) => content);

afterEach(() => {
  for (const { key } of toasts.visibleToasts) toasts.close(key);
});

test('a gesture done puts its rows into the summary and says so, with “Undo”', async () => {
  const { queryClient, cancel } = setUp(() =>
    Response.json({
      changes: changes({ contacts: [contact({ id: CONTACT_ID, name: 'After' })] }),
      undoToken: 'token',
    }),
  );

  const refused = await sendGesture(queryClient, cancel(), ({ contacts: [changed] }) =>
    changed ? `Done for ${changed.name}` : undefined,
  );

  expect(refused).toBeUndefined();
  expect(contactsOf(queryClient)).toEqual(['After']);
  expect(shownToasts()).toEqual([{ message: 'Done for After', undoToken: 'token' }]);
});

test('a gesture never undone says so without “Undo”', async () => {
  const queryClient = new QueryClient();
  const api = createApiClient(() =>
    Promise.resolve(
      Response.json({
        changes: changes({
          organizations: [organization({ id: ORGANIZATION_ID, name: 'Renamed' })],
        }),
      }),
    ),
  );
  const rename = api.organizations[':id'].rename.$post({
    param: { id: ORGANIZATION_ID },
    json: { name: 'Renamed' },
  });

  const refused = await sendGesture(queryClient, rename, () => 'Renamed');

  expect(refused).toBeUndefined();
  expect(shownToasts()).toStrictEqual([{ message: 'Renamed' }]);
});

test('a refused gesture answers its code, and the summary is read again', async () => {
  const { queryClient, cancel } = setUp(() =>
    Response.json({ error: 'no_follow_up' }, { status: 409 }),
  );

  const refused = await sendGesture(queryClient, cancel(), () => 'Never said');

  expect(refused).toEqual({ error: 'no_follow_up' });
  expect(queryClient.getQueryState(SUMMARY_KEY)?.isInvalidated).toBe(true);
  expect(shownToasts()).toEqual([]);
});

test('a body the server would not read, or a failure, is this app’s error, never a refusal', async () => {
  const invalid = setUp(() => Response.json({ error: 'invalid' }, { status: 400 }));
  await expect(sendGesture(invalid.queryClient, invalid.cancel(), () => '')).rejects.toThrow(
    'A gesture',
  );

  const failed = setUp(() => new Response('', { status: 500 }));
  await expect(sendGesture(failed.queryClient, failed.cancel(), () => '')).rejects.toThrow(
    'A gesture',
  );

  expect(invalid.queryClient.getQueryState(SUMMARY_KEY)?.isInvalidated).toBe(false);
});
