import { addDays, localDay, mondayOf } from '@battlecrm/domain';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const desktop = () => page.viewport(1280, 800);

const TIME_ZONE = 'Europe/Paris';
/** Today for the User, as the SPA reads it: the entries are counted in its week. */
const today = () => localDay(new Date(), TIME_ZONE);

const OUTREACH = {
  id: '01990000-0000-7000-8000-000000000011',
  name: 'Approche',
  aim: null,
  archived: false,
};
const AGENCY = {
  id: '01990000-0000-7000-8000-000000000012',
  name: 'Qualif ESN',
  aim: null,
  archived: false,
};
const OLD = {
  id: '01990000-0000-7000-8000-000000000013',
  name: 'Relance salon',
  aim: null,
  archived: true,
};
const CAPGEMINI = {
  id: '01990000-0000-7000-8000-000000000021',
  name: 'Capgemini',
  type: 'consultancy',
};

type Row = {
  id: string;
  name: string;
  status: string;
  stageId: string | null;
  funnelEntryDays: string[];
  statusReason: string | null;
};

const contact = (fields: Pick<Row, 'id' | 'name'> & Partial<Row>) => ({
  status: 'pool',
  stageId: null,
  organizationId: CAPGEMINI.id,
  jobTitle: null,
  email: null,
  phone: null,
  linkedinUrl: null,
  lastInteractionAt: '2026-01-08T09:00:00.000Z',
  lastInteractionOn: '2026-01-08',
  funnelEntryDays: [] as string[],
  statusReason: null as string | null,
  ...fields,
});

/** In the Pool, out of the Funnel at Qualif ESN; she entered it twice this week already, with Marc. */
const julie = () =>
  contact({
    id: '01990000-0000-7000-8000-000000000001',
    name: 'Julie Martin',
    stageId: AGENCY.id,
    funnelEntryDays: ['2025-06-02', mondayOf(today())],
  });
const marc = () =>
  contact({
    id: '01990000-0000-7000-8000-000000000002',
    name: 'Marc Petit',
    status: 'prospecting',
    stageId: OUTREACH.id,
    funnelEntryDays: [today()],
  });
const INES = contact({
  id: '01990000-0000-7000-8000-000000000003',
  name: 'Inès Moreau',
  status: 'ally',
});
const PAUL = contact({
  id: '01990000-0000-7000-8000-000000000004',
  name: 'Paul Durand',
  stageId: OLD.id,
});
const LEA = contact({
  id: '01990000-0000-7000-8000-000000000006',
  name: 'Léa Bernard',
});
const NINA = contact({
  id: '01990000-0000-7000-8000-000000000005',
  name: 'Nina Roux',
  status: 'archived',
  stageId: OUTREACH.id,
  statusReason: 'Changé de métier',
});

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;
const changeRoute = (id: string) => `POST /api/contacts/${id}/change-status`;

/** What the SPA sends to change a Status. */
const changeRequest = z.strictObject({
  status: z.enum(['pool', 'prospecting', 'ally', 'archived']),
  stageId: z.string().optional(),
  reason: z.string().optional(),
});

const changes = (contacts: object[]) => ({
  contacts,
  removedContactIds: [],
  organizations: [],
  removedOrganizationIds: [],
});

const threadOf = (reason: string | null) => ({
  note: null,
  thread: [
    {
      id: '01990000-0000-7000-8000-000000000031',
      kind: 'status_changed',
      direction: 'none',
      occurredAt: '2026-01-08T09:00:00.000Z',
      localDate: '2026-01-08',
      statusChange: {
        fromStatus: 'prospecting',
        toStatus: 'archived',
        stageId: OUTREACH.id,
        reason,
      },
    },
  ],
});

/** An API that changes the Status of any Contact as the server would, and takes it back. */
function statusApi() {
  const contacts = [julie(), marc(), INES, PAUL, NINA, LEA];
  const routes: Parameters<typeof fakeApi>[0] = {
    'GET /api/summary': () =>
      Response.json({
        timeZone: TIME_ZONE,
        contacts,
        stages: [OUTREACH, AGENCY, OLD],
        organizations: [CAPGEMINI],
      }),
    [UNDO_ROUTE]: () => Response.json({ changes: changes([julie()]) }),
  };
  for (const before of contacts) {
    routes[`GET /api/contacts/${before.id}/record`] = () =>
      Response.json(before.status === 'archived' ? threadOf('Changé de métier') : threadOf(null));
    routes[changeRoute(before.id)] = (body) => {
      const sent = changeRequest.parse(body);
      const entered = sent.status === 'prospecting';
      return Response.json({
        changes: changes([
          {
            ...before,
            status: sent.status,
            stageId: sent.stageId ?? before.stageId,
            funnelEntryDays: entered
              ? [...before.funnelEntryDays, today()]
              : before.funnelEntryDays,
          },
        ]),
        undoToken: UNDO_TOKEN,
      });
    };
  }
  return fakeApi(routes);
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

test('a Contact of the Pool says where it left the Funnel; “Bring in…” enters it at that Stage, then “Undo”', async () => {
  await desktop();
  const api = statusApi();
  await renderApp(`/contacts/${julie().id}`, api);
  const next = page.getByRole('region', { name: 'Prochaine action' });
  await expect.element(next).toHaveTextContent('Au Vivier · dernière Étape : Qualif ESN');
  const bringIn = next.getByRole('button', { name: 'Faire entrer…' });

  await bringIn.click();

  const dialog = page.getByRole('dialog', { name: 'Faire entrer Julie Martin' });
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByRole('combobox', { name: 'Étape' })).toHaveValue(AGENCY.id);
  await expect.element(dialog.getByRole('combobox', { name: 'Étape' })).toHaveFocus();
  // Archived Stages are never offered.
  await expect
    .element(dialog.getByRole('option', { name: 'Relance salon' }))
    .not.toBeInTheDocument();
  await expect.element(dialog).toHaveTextContent('Entrée n°3 cette semaine (3/5)');
  await dialog.getByRole('textbox', { name: 'Motif (facultatif)' }).fill('Revenue de congés');
  // `Enter` validates from the list of Stages too.
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
  await expect.element(dialog.getByRole('combobox', { name: 'Étape' })).toHaveFocus();
  await userEvent.keyboard('{Enter}');

  await expect
    .element(page.getByText('Julie Martin entre dans le Funnel à Qualif ESN · Entrées 3/5'))
    .toBeVisible();
  expect(api.sent(changeRoute(julie().id)).map(({ body }) => body)).toEqual([
    { status: 'prospecting', stageId: AGENCY.id, reason: 'Revenue de congés' },
  ]);
  await expect.element(dialog).not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: "Changer d'État : En prospection" }))
    .toBeVisible();

  await page.getByRole('button', { name: /^Annuler$/ }).click();

  await expect.element(page.getByText('Annulé.')).toBeVisible();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
  await expect.element(next).toHaveTextContent('Au Vivier · dernière Étape : Qualif ESN');
});

test('a Stage must be chosen when the last one reached is archived', async () => {
  await desktop();
  const api = statusApi();
  await renderApp(`/contacts/${PAUL.id}`, api);
  await expect
    .element(page.getByRole('region', { name: 'Prochaine action' }))
    .toHaveTextContent('Au Vivier · dernière Étape : Relance salon');
  await page.getByRole('button', { name: 'Faire entrer…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Faire entrer Paul Durand' });
  const stage = dialog.getByRole('combobox', { name: 'Étape' });
  await expect.element(stage).toHaveValue('');

  await dialog.getByRole('button', { name: 'Faire entrer' }).click();

  await expect.element(dialog.getByText("Choisis l'Étape où il entre.")).toBeVisible();
  await expect.element(stage).toHaveAttribute('aria-invalid', 'true');
  expect(api.sent(changeRoute(PAUL.id))).toEqual([]);
  await stage.selectOptions(OUTREACH.id);
  await dialog.getByRole('button', { name: 'Faire entrer' }).click();
  await expect.poll(() => api.sent(changeRoute(PAUL.id))).toHaveLength(1);
  expect(api.sent(changeRoute(PAUL.id))[0]?.body).toEqual({
    status: 'prospecting',
    stageId: OUTREACH.id,
  });
});

test('from the panel, “Add to Circle…” keeps the last Stage and says where the Circle stands', async () => {
  await desktop();
  const api = statusApi();
  await renderApp(`/contacts?contact=${marc().id}`, api);
  const panel = page.getByRole('region', { name: 'Marc Petit' });

  await panel.getByRole('button', { name: "Plus d'actions" }).click();
  await page.getByRole('menuitem', { name: 'Ajouter au Cercle…' }).click();

  const dialog = page.getByRole('dialog', { name: 'Ajouter Marc Petit au Cercle' });
  const nextCheckIn = new Intl.DateTimeFormat('fr', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${addDays(today(), 28)}T12:00:00Z`));
  await expect
    .element(dialog)
    .toHaveTextContent(`Cercle 2/10 · prochaines nouvelles d'ici le ${nextCheckIn} (Rythme 28 j)`);
  await expect.element(dialog).toHaveTextContent('Garde sa dernière Étape atteinte : Approche');
  await dialog.getByRole('button', { name: 'Ajouter au Cercle' }).click();

  await expect.element(page.getByText('Marc Petit entre au Cercle · 2/10')).toBeVisible();
  expect(api.sent(changeRoute(marc().id)).map(({ body }) => body)).toEqual([{ status: 'ally' }]);
});

test('“Change status…” (S) starts with the choice of the target, never the current Status; Escape gives the focus back', async () => {
  await desktop();
  const api = statusApi();
  await renderApp(`/contacts/${INES.id}`, api);
  await expect.element(page.getByRole('heading', { level: 1, name: /Inès Moreau/ })).toBeVisible();

  await userEvent.keyboard('s');

  const dialog = page.getByRole('dialog', { name: "Changer l'État de Inès Moreau" });
  await expect.element(dialog).toBeVisible();
  const targets = dialog.getByRole('radiogroup', { name: 'Nouvel État' });
  await expect.element(targets.getByRole('radio', { name: 'Faire entrer' })).toBeVisible();
  await expect.element(targets.getByRole('radio', { name: 'Remettre au Vivier' })).toBeVisible();
  await expect.element(targets.getByRole('radio', { name: 'Archiver' })).toBeVisible();
  await expect
    .element(targets.getByRole('radio', { name: 'Ajouter au Cercle' }))
    .not.toBeInTheDocument();
  await targets.getByText('Archiver').click();
  await dialog.getByRole('textbox', { name: 'Motif (facultatif)' }).fill('A changé de métier');
  await userEvent.keyboard('{Escape}');
  await expect.element(dialog).not.toBeInTheDocument();
  expect(api.sent(changeRoute(INES.id))).toEqual([]);

  // The pill of the Status opens it too, and gives the focus back to it.
  const pill = page.getByRole('button', { name: "Changer d'État : Allié" });
  await pill.click();
  await page.getByRole('dialog').getByRole('radiogroup').getByText('Archiver').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archiver' }).click();
  await expect.element(page.getByText('Inès Moreau est archivé')).toBeVisible();
  expect(api.sent(changeRoute(INES.id)).map(({ body }) => body)).toEqual([{ status: 'archived' }]);
  // The same pill, now named after the new Status.
  await expect
    .element(page.getByRole('button', { name: "Changer d'État : Archivé" }))
    .toHaveFocus();
});

test('an archived record is greyed, says why, and offers every way back', async () => {
  await desktop();
  await renderApp(`/contacts/${NINA.id}`, statusApi());
  const next = page.getByRole('region', { name: 'Prochaine action' });

  await expect.element(next).toHaveTextContent('Changé de métier');
  await expect.element(next).toHaveTextContent("Rien n'est définitif : tu peux le faire revenir.");
  await expect.element(next.getByRole('button', { name: 'Faire entrer…' })).toBeVisible();
  await expect.element(next.getByRole('button', { name: 'Remettre au Vivier…' })).toBeVisible();
  await expect.element(next.getByRole('button', { name: 'Ajouter au Cercle…' })).toBeVisible();
  await expect.element(next.getByRole('button', { name: 'Archiver…' })).not.toBeInTheDocument();
});

test('a Contact never entered says so, and “Bring in…” must choose a Stage', async () => {
  await desktop();
  await renderApp(`/contacts/${LEA.id}`, statusApi());
  await expect
    .element(page.getByRole('region', { name: 'Prochaine action' }))
    .toHaveTextContent('Au Vivier · jamais entré');

  await page.getByRole('button', { name: 'Faire entrer…' }).click();
  await expect
    .element(page.getByRole('dialog').getByRole('combobox', { name: 'Étape' }))
    .toHaveValue('');
});

test('the open panel and its draft come back with the page', async () => {
  await desktop();
  const api = statusApi();
  const { screen, router } = await renderApp(`/contacts/${marc().id}`, api);
  await page.getByRole('button', { name: 'Remettre au Vivier…' }).click();
  await page.getByRole('textbox', { name: 'Motif (facultatif)' }).fill('Silence depuis un mois');
  const href = router.state.location.href;
  await screen.unmount();

  await renderApp(href, api);

  const dialog = page.getByRole('dialog', { name: 'Remettre Marc Petit au Vivier' });
  await expect.element(dialog).toBeVisible();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Motif (facultatif)' }))
    .toHaveValue('Silence depuis un mois');
  await dialog.getByRole('button', { name: 'Remettre au Vivier' }).click();
  await expect.element(page.getByText('Marc Petit est remis au Vivier')).toBeVisible();
  expect(sessionStorage.length).toBe(0);
});

test('on mobile, the panel is a full-screen sheet, its button stuck at the bottom', async () => {
  await page.viewport(390, 844);
  await renderApp(`/contacts/${marc().id}`, statusApi());
  await page.getByRole('button', { name: "Plus d'actions" }).click();
  await page.getByRole('menuitem', { name: 'Archiver…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Archiver Marc Petit' });

  await expect.element(dialog).toBeVisible();
  const sheet = dialog.element().closest('[data-slot="dialog-content"]')!.getBoundingClientRect();
  expect([sheet.left, sheet.top, sheet.width, sheet.height]).toEqual([0, 0, 390, 844]);
  const submit = dialog.getByRole('button', { name: 'Archiver' }).element().getBoundingClientRect();
  expect(submit.bottom).toBeGreaterThan(844 - 80);
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect.element(dialog).not.toBeInTheDocument();
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing on a record and its panel of gesture, in the %s theme',
  async (scheme) => {
    await commands.emulateColorScheme(scheme);
    await desktop();
    await renderApp(`/contacts/${NINA.id}`, statusApi());
    await expect.element(page.getByText('Motif : Changé de métier')).toBeVisible();
    await expectNoAxeViolations();
    await page.getByRole('button', { name: 'Faire entrer…' }).click();
    await expect.element(page.getByRole('dialog')).toBeVisible();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');

    await expectNoAxeViolations();
  },
);
