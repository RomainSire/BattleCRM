import { localDay } from '@battlecrm/domain';
import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { changes, contact, DEVICE_TIME_ZONE, stage, summary } from '../../test/summary.ts';

const desktop = () => page.viewport(1280, 800);

const OUTREACH = stage({ id: '01990000-0000-7000-8000-000000000011', name: 'Approche' });
const today = () => localDay(new Date(), DEVICE_TIME_ZONE);
/** Prospecting, with two Prospecting actions today. */
const JULIE = contact({
  id: '01990000-0000-7000-8000-000000000001',
  name: 'Julie Martin',
  status: 'prospecting',
  stageId: OUTREACH.id,
  prospectingActionDays: [today(), today()],
});
const MARC = contact({ id: '01990000-0000-7000-8000-000000000002', name: 'Marc Petit' });
const DELETE_ROUTE = `POST /api/contacts/${JULIE.id}/delete`;

/** An API that deletes Julie as the server would: out of the summary, no token. */
function deletingApi(trialCount: number) {
  let contacts = [JULIE, MARC];
  // Her days still count once she is deleted, nothing else of her.
  let deletedContactDays = { funnelEntryDays: [], prospectingActionDays: [] as string[] };
  return fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          contacts,
          stages: [OUTREACH],
          deletedContactDays,
          settings: { activityGoal: { inEffect: 3, chosen: 3 } },
        }),
      ),
    [`GET /api/contacts/${JULIE.id}/record`]: () =>
      Response.json({ note: null, trialCount, thread: [] }),
    [DELETE_ROUTE]: () => {
      contacts = [MARC];
      deletedContactDays = { funnelEntryDays: [], prospectingActionDays: [today(), today()] };
      return Response.json({
        changes: changes({ removedContactIds: [JULIE.id], deletedContactDays }),
      });
    },
  });
}

const openDeletion = async () => {
  await page
    .getByRole('region', { name: 'Prochaine action' })
    .getByRole('button', { name: "Plus d'actions" })
    .click();
  await page.getByRole('menuitem', { name: 'Supprimer le Contact…' }).click();
  return page.getByRole('dialog', { name: 'Supprimer Julie Martin ?' });
};

beforeEach(() => {
  sessionStorage.clear();
});

test('“Delete the Contact…” says what is erased and what stays, then the Contact is gone, with no “Undo”', async () => {
  await desktop();
  const api = deletingApi(2);
  await renderApp(`/contacts/${JULIE.id}`, api);

  const dialog = await openDeletion();

  await expect
    .element(dialog)
    .toHaveTextContent(
      'Ses coordonnées et ses notes sont effacées définitivement. Ses 2 Essais restent dans les Battles, sans son nom.',
    );
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();

  await expect.poll(() => api.sent(DELETE_ROUTE)).toHaveLength(1);
  await expect.element(page.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();
  await expect.element(page.getByText('Contact supprimé : Julie Martin')).toBeVisible();
  await expect.element(page.getByRole('button', { name: /^Annuler$/ })).not.toBeInTheDocument();
  await expect.element(page.getByText('Marc Petit')).toBeVisible();
  await expect.element(page.getByText('Julie Martin', { exact: true })).not.toBeInTheDocument();
});

test('“Archive instead” only stops prospecting: the window of the change of Status opens instead', async () => {
  await desktop();
  const api = deletingApi(1);
  await renderApp(`/contacts/${JULIE.id}`, api);

  const dialog = await openDeletion();
  await expect.element(dialog).toHaveTextContent('Son Essai reste dans les Battles, sans son nom.');
  await dialog.getByRole('button', { name: 'Archiver à la place' }).click();

  await expect.element(page.getByRole('dialog', { name: 'Archiver Julie Martin' })).toBeVisible();
  await expect.element(dialog).not.toBeInTheDocument();
  expect(api.sent(DELETE_ROUTE)).toHaveLength(0);
});

test('the Activity of the day keeps the actions of a deleted Contact: it never changes after the fact', async () => {
  await desktop();
  const { router } = await renderApp(`/contacts/${JULIE.id}`, deletingApi(0));

  const dialog = await openDeletion();
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect.element(page.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();
  await router.navigate({ to: '/today' });

  await expect
    .element(page.getByRole('region', { name: /^Activité du jour/ }))
    .toHaveTextContent('2/3');
});
