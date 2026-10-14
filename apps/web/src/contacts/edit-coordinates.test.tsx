import { afterEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const desktop = () => page.viewport(1280, 800);

const CAPGEMINI = {
  id: '01990000-0000-7000-8000-000000000021',
  name: 'Capgemini',
  type: 'consultancy',
};
const NORDIKA = { id: '01990000-0000-7000-8000-000000000022', name: 'Nordika', type: 'end_client' };
const SOPRA = { id: '01990000-0000-7000-8000-000000000023', name: 'Sopra', type: 'consultancy' };
const OUTREACH = {
  id: '01990000-0000-7000-8000-000000000011',
  name: 'Approche',
  aim: 'CV à envoyer',
  archived: false,
};

const JULIE = {
  id: '01990000-0000-7000-8000-000000000001',
  name: 'Julie Martin',
  status: 'prospecting',
  stageId: OUTREACH.id,
  organizationId: CAPGEMINI.id,
  jobTitle: 'Responsable recrutement',
  email: 'julie.martin@capgemini.com',
  phone: null,
  linkedinUrl: 'https://linkedin.com/in/juliemartin',
  lastInteractionAt: '2026-01-08T09:00:00.000Z',
  lastInteractionOn: '2026-01-08',
  followUp: null,
  prospectingActionDays: [],
};
const INES = {
  ...JULIE,
  id: '01990000-0000-7000-8000-000000000003',
  name: 'Inès Moreau',
  status: 'ally',
  stageId: null,
  organizationId: NORDIKA.id,
  jobTitle: null,
  email: 'ines@nordika.io',
  linkedinUrl: 'https://linkedin.com/in/ines-moreau',
};

const record = (note: string | null) => ({
  note,
  thread: [
    {
      id: '01990000-0000-7000-8000-000000000031',
      kind: 'contact_added',
      direction: 'none',
      occurredAt: JULIE.lastInteractionAt,
      localDate: JULIE.lastInteractionOn,
      statusChange: {
        fromStatus: null,
        toStatus: 'prospecting',
        stageId: OUTREACH.id,
        reason: null,
      },
    },
  ],
});

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const EDIT_ROUTE = `POST /api/contacts/${JULIE.id}/edit`;
const RECORD_ROUTE = `GET /api/contacts/${JULIE.id}/record`;
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;

/** What the SPA sends to edit the Coordinates. */
const editRequest = z.object({
  name: z.string(),
  organizationId: z.string().optional(),
  newOrganization: z.object({ name: z.string(), type: z.string() }).optional(),
  jobTitle: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  note: z.string().optional(),
});

const changes = (contacts: object[], organizations: object[] = []) => ({
  contacts,
  removedContactIds: [],
  organizations,
  removedOrganizationIds: [],
});

/**
 * An API that knows Julie and Inès, edits Julie with what is sent, as the server would, and takes the
 * edit back; the note it keeps follows.
 */
function editApi() {
  let note: string | null = 'Rencontrée au meetup Rust Lyon.';
  return fakeApi({
    'GET /api/summary': () =>
      Response.json({
        contacts: [JULIE, INES],
        stages: [OUTREACH],
        organizations: [CAPGEMINI, NORDIKA],
      }),
    [RECORD_ROUTE]: () => Response.json(record(note)),
    [EDIT_ROUTE]: (body) => {
      const sent = editRequest.parse(body);
      note = sent.note ?? null;
      const created = sent.newOrganization ? SOPRA : undefined;
      return Response.json({
        changes: changes(
          [
            {
              ...JULIE,
              name: sent.name,
              organizationId: created?.id ?? sent.organizationId ?? null,
              jobTitle: sent.jobTitle ?? null,
              email: sent.email ?? null,
              phone: sent.phone ?? null,
              linkedinUrl: sent.linkedinUrl ?? null,
            },
          ],
          created ? [created] : [],
        ),
        undoToken: UNDO_TOKEN,
      });
    },
    [UNDO_ROUTE]: () => {
      note = 'Rencontrée au meetup Rust Lyon.';
      return Response.json({ changes: changes([JULIE]) });
    },
  });
}

/** The page of Julie, with her Coordinates opened for editing. */
async function editJulie(api = editApi()) {
  await desktop();
  const rendered = await renderApp(`/contacts/${JULIE.id}`, api);
  const coordinates = page.getByRole('region', { name: 'Coordonnées' });
  await expect.element(coordinates.getByText('Rencontrée au meetup Rust Lyon.')).toBeVisible();
  await coordinates.getByRole('button', { name: 'Modifier' }).click();
  await expect.element(coordinates.getByRole('textbox', { name: 'Nom' })).toHaveFocus();
  return { ...rendered, api, coordinates };
}

const organizationField = (coordinates: ReturnType<typeof page.getByRole>) =>
  coordinates.getByRole('combobox', { name: 'Organisation' });

/** Types an Organization, then leaves its field as a User does: the list it opened closes. */
async function typeOrganization(coordinates: ReturnType<typeof page.getByRole>, text: string) {
  await organizationField(coordinates).fill(text);
  await userEvent.keyboard('{Tab}');
  await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
}

/**
 * Types in the Organization field, then chooses in the list it opened, once the list is done coming
 * in: clicked while it moves, the click is retried after a scroll, which closes the list.
 */
async function chooseOrganization(
  coordinates: ReturnType<typeof page.getByRole>,
  text: string,
  option: string,
) {
  await organizationField(coordinates).fill(text);
  await expect.element(page.getByRole('option', { name: option })).toBeVisible();
  await expect.poll(() => document.getAnimations().length).toBe(0);
  await page.getByRole('option', { name: option }).click();
  await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
}

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

test('the Coordinates are edited in place, every field filled in; Enter saves, then “Undo”', async () => {
  const { api, coordinates } = await editJulie();
  await expect
    .element(coordinates.getByRole('textbox', { name: 'Poste' }))
    .toHaveValue('Responsable recrutement');
  await expect.element(organizationField(coordinates)).toHaveValue('Capgemini');
  await expect
    .element(coordinates.getByRole('textbox', { name: 'Note' }))
    .toHaveValue('Rencontrée au meetup Rust Lyon.');
  // Neither the Stage nor the Status are edited here.
  await expect.element(coordinates.getByText('Étape')).not.toBeInTheDocument();
  await expect.element(coordinates.getByText('État')).not.toBeInTheDocument();

  await coordinates.getByRole('textbox', { name: 'Nom' }).fill('Julie Martin-Roux');
  await coordinates.getByRole('textbox', { name: 'Téléphone' }).fill('06 12 34 56 78');
  await coordinates.getByRole('textbox', { name: 'Note' }).fill('Préfère le téléphone.');
  await coordinates.getByRole('textbox', { name: 'Téléphone' }).click();
  await userEvent.keyboard('{Enter}');

  await expect.element(page.getByText('Coordonnées de Julie Martin-Roux modifiées')).toBeVisible();
  expect(api.sent(EDIT_ROUTE).map(({ body }) => body)).toEqual([
    {
      name: 'Julie Martin-Roux',
      organizationId: CAPGEMINI.id,
      linkedinUrl: 'https://linkedin.com/in/juliemartin',
      jobTitle: 'Responsable recrutement',
      email: 'julie.martin@capgemini.com',
      phone: '06 12 34 56 78',
      note: 'Préfère le téléphone.',
    },
  ]);
  await expect
    .element(page.getByRole('heading', { level: 1, name: 'Julie Martin-Roux' }))
    .toBeVisible();
  await expect.element(coordinates.getByText('Préfère le téléphone.')).toBeVisible();
  await expect.element(coordinates.getByRole('button', { name: 'Modifier' })).toHaveFocus();

  await page.getByRole('button', { name: /Annuler/ }).click();

  await expect.element(page.getByText('Annulé.')).toBeVisible();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
  await expect.element(page.getByRole('heading', { level: 1, name: 'Julie Martin' })).toBeVisible();
  await expect.element(coordinates.getByText('Rencontrée au meetup Rust Lyon.')).toBeVisible();
});

test('Escape cancels the edit, and leaves the panel open', async () => {
  await desktop();
  const api = editApi();
  await renderApp(`/contacts?contact=${JULIE.id}`, api);
  const panel = page.getByRole('region', { name: 'Julie Martin' });
  await panel.getByRole('tab', { name: 'Détails' }).click();
  await expect.element(panel.getByText('Rencontrée au meetup Rust Lyon.')).toBeVisible();
  await panel.getByRole('button', { name: 'Modifier' }).click();

  await panel.getByRole('textbox', { name: 'Nom' }).fill('Julie M.');
  // An open list of Organizations closes first.
  await organizationField(panel).fill('nor');
  await expect.element(page.getByRole('listbox')).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
  await expect.element(panel.getByRole('textbox', { name: 'Nom' })).toBeVisible();
  await userEvent.keyboard('{Escape}');

  await expect.element(panel.getByRole('textbox', { name: 'Nom' })).not.toBeInTheDocument();
  await expect.element(panel).toBeVisible();
  await expect.element(panel.getByRole('button', { name: 'Modifier' })).toHaveFocus();
  expect(api.sent(EDIT_ROUTE)).toEqual([]);
});

test('saving nothing changed sends nothing', async () => {
  const { api, coordinates } = await editJulie();

  await coordinates.getByRole('button', { name: 'Enregistrer' }).click();

  await expect.element(coordinates.getByRole('textbox', { name: 'Nom' })).not.toBeInTheDocument();
  expect(api.sent(EDIT_ROUTE)).toEqual([]);
});

test('another Organization says what changes: the new Target, the Trial, no Interaction', async () => {
  const { api, coordinates } = await editJulie();
  await expect.element(coordinates.getByText('Ce qui change')).not.toBeInTheDocument();

  await chooseOrganization(coordinates, 'nord', 'Nordika');
  await expect.element(organizationField(coordinates)).toHaveValue('Nordika');

  const what = coordinates.getByRole('region', { name: 'Ce qui change' });
  await expect.element(what).toHaveTextContent('Nouvelle Cible : Client final');
  await expect.element(what).toHaveTextContent("L'Essai en cours garde sa Cible de départ");
  await expect.element(what).toHaveTextContent("Aucune Interaction n'est enregistrée");
  await coordinates.getByRole('button', { name: 'Enregistrer' }).click();

  await expect.poll(() => api.sent(EDIT_ROUTE)).toHaveLength(1);
  expect(api.sent(EDIT_ROUTE)[0]?.body).toMatchObject({ organizationId: NORDIKA.id });
  await expect.element(coordinates.getByText('Client final')).toBeVisible();
});

test('a new Organization is created with its type, which must be chosen', async () => {
  const { api, coordinates } = await editJulie();

  await typeOrganization(coordinates, 'Sopra');
  const what = coordinates.getByRole('region', { name: 'Ce qui change' });
  await expect.element(what).toHaveTextContent("L'Organisation Sopra est créée");
  await coordinates.getByRole('button', { name: 'Enregistrer' }).click();
  await expect
    .element(coordinates.getByText('Choisis le type de cette nouvelle Organisation.'))
    .toBeVisible();
  expect(api.sent(EDIT_ROUTE)).toEqual([]);

  await coordinates.getByRole('radiogroup').getByText('ESN', { exact: true }).click();
  await expect.element(what).toHaveTextContent('Nouvelle Cible : ESN');
  await coordinates.getByRole('button', { name: 'Enregistrer' }).click();

  await expect.poll(() => api.sent(EDIT_ROUTE)).toHaveLength(1);
  expect(api.sent(EDIT_ROUTE)[0]?.body).toMatchObject({
    newOrganization: { name: 'Sopra', type: 'consultancy' },
  });
  expect(api.sent(EDIT_ROUTE)[0]?.body).not.toHaveProperty('organizationId');
  await expect.element(coordinates.getByText('Sopra', { exact: true })).toBeVisible();
});

test('“No Organization” empties the field: the Target becomes unknown', async () => {
  const { api, coordinates } = await editJulie();

  await chooseOrganization(coordinates, 'cap', 'Aucune Organisation');

  await expect.element(organizationField(coordinates)).toHaveValue('');
  const what = coordinates.getByRole('region', { name: 'Ce qui change' });
  await expect.element(what).toHaveTextContent('Nouvelle Cible : Inconnue');
  await coordinates.getByRole('button', { name: 'Enregistrer' }).click();

  await expect.poll(() => api.sent(EDIT_ROUTE)).toHaveLength(1);
  expect(api.sent(EDIT_ROUTE)[0]?.body).not.toHaveProperty('organizationId');
  expect(api.sent(EDIT_ROUTE)[0]?.body).not.toHaveProperty('newOrganization');
});

test('the LinkedIn profile of another Contact blocks the edit; her own e-mail is no duplicate, another one is noted', async () => {
  const { api, coordinates } = await editJulie();
  await expect.element(coordinates.getByText(/déjà celui de/)).not.toBeInTheDocument();
  await expect.element(coordinates.getByRole('alert')).not.toBeInTheDocument();

  await coordinates.getByRole('textbox', { name: 'E-mail' }).fill('INES@nordika.io');
  await expect
    .element(coordinates.getByText('Cet e-mail est déjà celui de Inès Moreau · Nordika'))
    .toBeVisible();
  await coordinates
    .getByRole('textbox', { name: 'URL LinkedIn' })
    .fill('www.linkedin.com/in/ines-moreau/');

  await expect
    .element(coordinates.getByRole('alert'))
    .toHaveTextContent('Ce Contact existe déjà : Inès Moreau · Nordika');
  await coordinates.getByRole('button', { name: 'Enregistrer' }).click();
  expect(api.sent(EDIT_ROUTE)).toEqual([]);

  await coordinates
    .getByRole('textbox', { name: 'URL LinkedIn' })
    .fill('linkedin.com/in/juliemartin');
  await expect.element(coordinates.getByRole('alert')).not.toBeInTheDocument();
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing on the Coordinates being edited, in the %s theme',
  async (scheme) => {
    await commands.emulateColorScheme(scheme);
    const { coordinates } = await editJulie();
    await typeOrganization(coordinates, 'Sopra');
    await expect.element(coordinates.getByText('Ce qui change')).toBeVisible();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');

    await expectNoAxeViolations();
  },
);
