import { afterEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const desktop = () => page.viewport(1280, 800);

const ACME = { id: '01990000-0000-7000-8000-000000000021', name: 'Acme', type: 'end_client' };
const ACME_TYPO = { id: '01990000-0000-7000-8000-000000000022', name: 'Acmé', type: 'consultancy' };
const GLOBEX = { id: '01990000-0000-7000-8000-000000000023', name: 'Globex', type: 'consultancy' };
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
  organizationId: ACME.id,
  jobTitle: null,
  email: null,
  phone: null,
  linkedinUrl: null,
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
};
const PAUL = {
  ...JULIE,
  id: '01990000-0000-7000-8000-000000000004',
  name: 'Paul Durand',
  status: 'pool',
  stageId: null,
  organizationId: ACME_TYPO.id,
};

const changes = (organizations: object[], more: object = {}) => ({
  contacts: [],
  removedContactIds: [],
  organizations,
  removedOrganizationIds: [],
  ...more,
});

const route = (organization: { id: string }, gesture: string) =>
  `POST /api/organizations/${organization.id}/${gesture}`;

/** An API that knows Acme and its two Contacts, Acmé and Paul, Globex alone; each gesture answers as the server would. */
function organizationApi(routes: Parameters<typeof fakeApi>[0] = {}) {
  let merged = false;
  return fakeApi({
    'GET /api/summary': () =>
      Response.json({
        contacts: [JULIE, INES, merged ? { ...PAUL, organizationId: ACME.id } : PAUL],
        stages: [OUTREACH],
        organizations: merged ? [ACME, GLOBEX] : [ACME, ACME_TYPO, GLOBEX],
      }),
    [`GET /api/contacts/${JULIE.id}/record`]: () => Response.json({ note: null, thread: [] }),
    [route(ACME, 'rename')]: (body) =>
      Response.json({
        changes: changes([{ ...ACME, name: z.object({ name: z.string() }).parse(body).name }]),
      }),
    [route(ACME, 'change-type')]: () =>
      Response.json({ changes: changes([{ ...ACME, type: 'consultancy' }]) }),
    [route(GLOBEX, 'change-type')]: () =>
      Response.json({ changes: changes([{ ...GLOBEX, type: 'end_client' }]) }),
    [route(ACME_TYPO, 'merge')]: () => {
      merged = true;
      return Response.json({
        changes: changes([ACME], {
          contacts: [{ ...PAUL, organizationId: ACME.id }],
          removedOrganizationIds: [ACME_TYPO.id],
        }),
      });
    },
    [route(GLOBEX, 'delete')]: () =>
      Response.json({ changes: changes([], { removedOrganizationIds: [GLOBEX.id] }) }),
    ...routes,
  });
}

async function openOrganization(organization: { id: string }, api = organizationApi()) {
  const rendered = await renderApp(`/organizations/${organization.id}`, api);
  return { ...rendered, api };
}

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

test('the page of an Organization: its name, its type, its Contacts with their Stage, Status and next action', async () => {
  await desktop();
  await openOrganization(ACME);

  await expect.element(page.getByRole('heading', { level: 1, name: 'Acme' })).toBeVisible();
  await expect.element(page.getByText('Client final', { exact: true })).toBeVisible();
  const breadcrumb = page.getByRole('navigation', { name: "Fil d'Ariane" });
  await expect.element(breadcrumb.getByRole('link', { name: 'Contacts' })).toBeVisible();
  await expect.element(breadcrumb.getByText('Acme')).toHaveAttribute('aria-current', 'page');
  await expect
    .element(page.getByRole('link', { name: 'Contacts', exact: true }).first())
    .toHaveAttribute('aria-current', 'page');

  const contacts = page.getByRole('list', { name: 'Contacts de Acme' });
  await expect.element(contacts.getByRole('listitem')).toHaveLength(2);
  const julie = contacts.getByRole('listitem').filter({ hasText: 'Julie Martin' });
  await expect
    .element(julie)
    .toHaveTextContent('Approche · En prospection · Sans prochaine action');
  const ines = contacts.getByRole('listitem').filter({ hasText: 'Inès Moreau' });
  await expect.element(ines.getByRole('link', { name: 'Inès Moreau Allié' })).toBeVisible();
  await expect.element(ines).not.toHaveTextContent('Sans prochaine action');
  await expect.element(page.getByText('Paul Durand')).not.toBeInTheDocument();
});

test('the name of the Organization on the record of a Contact leads to its page', async () => {
  await desktop();
  await renderApp(`/contacts/${JULIE.id}`, organizationApi());

  await page
    .getByRole('region', { name: 'Coordonnées' })
    .getByRole('link', { name: 'Acme' })
    .click();

  await expect.element(page.getByRole('heading', { level: 1, name: 'Acme' })).toBeVisible();
});

test('“Rename” edits the name in place; Enter saves it; a name another Organization has is refused', async () => {
  await desktop();
  const { api } = await openOrganization(ACME);

  await page.getByRole('button', { name: 'Renommer' }).click();
  const name = page.getByRole('textbox', { name: "Nom de l'Organisation" });
  await expect.element(name).toHaveFocus();
  await name.fill('globex ');
  await userEvent.keyboard('{Enter}');
  await expect.element(page.getByText('Une autre Organisation porte déjà ce nom.')).toBeVisible();
  await expect.element(name).toHaveAttribute('aria-invalid', 'true');
  expect(api.sent(route(ACME, 'rename'))).toEqual([]);

  await name.fill('Acme Corp');
  await userEvent.keyboard('{Enter}');

  await expect.element(page.getByRole('heading', { level: 1, name: 'Acme Corp' })).toBeVisible();
  expect(api.sent(route(ACME, 'rename')).map(({ body }) => body)).toEqual([{ name: 'Acme Corp' }]);
  await expect.element(page.getByText('Organisation renommée : Acme Corp')).toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Renommer' })).toHaveFocus();
});

test('Escape cancels the rename', async () => {
  await desktop();
  const { api } = await openOrganization(ACME);
  await page.getByRole('button', { name: 'Renommer' }).click();
  await page.getByRole('textbox', { name: "Nom de l'Organisation" }).fill('Acme Corp');

  await userEvent.keyboard('{Escape}');

  await expect.element(page.getByRole('heading', { level: 1, name: 'Acme' })).toBeVisible();
  expect(api.sent(route(ACME, 'rename'))).toEqual([]);
});

test('changing the type says what it changes for its Contacts, then asks to confirm', async () => {
  await desktop();
  const { api } = await openOrganization(ACME);

  await page.getByRole('button', { name: 'Passer en ESN…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Passer Acme en ESN ?' });
  await expect
    .element(dialog)
    .toHaveTextContent(
      '2 Contacts passent en Cible ESN. Les Essais déjà commencés gardent leur Cible.',
    );
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect.element(dialog).not.toBeInTheDocument();
  expect(api.sent(route(ACME, 'change-type'))).toEqual([]);

  await page.getByRole('button', { name: 'Passer en ESN…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Passer en ESN' }).click();

  await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
  expect(api.sent(route(ACME, 'change-type')).map(({ body }) => body)).toEqual([
    { type: 'consultancy' },
  ]);
  await expect.element(page.getByText('ESN', { exact: true })).toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Passer en Client final…' })).toBeVisible();
});

test('without a Contact, the type changes at once', async () => {
  await desktop();
  const { api } = await openOrganization(GLOBEX);
  await expect.element(page.getByText('Aucun Contact dans cette Organisation.')).toBeVisible();

  await page.getByRole('button', { name: 'Passer en Client final' }).click();

  await expect.poll(() => api.sent(route(GLOBEX, 'change-type'))).toHaveLength(1);
  await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
  await expect.element(page.getByText('Client final', { exact: true })).toBeVisible();
});

test('“Merge with…” chooses the Organization that stays: the Contacts of the other one join it and take its type', async () => {
  await desktop();
  const { api } = await openOrganization(ACME_TYPO);

  await page.getByRole('button', { name: 'Fusionner avec…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Fusionner Acmé avec…' });
  await dialog.getByRole('button', { name: 'Fusionner' }).click();
  await expect
    .element(dialog.getByText("Choisis l'Organisation avec laquelle fusionner."))
    .toBeVisible();
  await dialog.getByRole('combobox', { name: 'Organisation' }).fill('acm');
  await expect.element(page.getByRole('option', { name: 'Acmé' })).not.toBeInTheDocument();
  await page.getByRole('option', { name: 'Acme' }).click();
  // The one chosen stays by default.
  await expect.element(dialog.getByRole('radio', { name: 'Acme' })).toBeChecked();
  await expect
    .element(dialog)
    .toHaveTextContent(
      '1 Contact rejoint Acme, qui reste. Acmé est supprimée. 1 Contact passe en Cible Client final. Les Essais déjà commencés gardent leur Cible.',
    );

  await dialog.getByRole('button', { name: 'Fusionner' }).click();

  expect(api.sent(route(ACME_TYPO, 'merge')).map(({ body }) => body)).toEqual([
    { intoId: ACME.id },
  ]);
  // The page that went leads to the one that stays.
  await expect.element(page.getByRole('heading', { level: 1, name: 'Acme' })).toBeVisible();
  const contacts = page.getByRole('list', { name: 'Contacts de Acme' });
  await expect.element(contacts.getByRole('listitem')).toHaveLength(3);
  await expect.element(page.getByText('Acmé fusionnée dans Acme')).toBeVisible();
});

test('the Organization of the page may be the one that stays', async () => {
  await desktop();
  const { api } = await openOrganization(
    ACME,
    organizationApi({
      [route(ACME_TYPO, 'merge')]: () => Response.json({ error: 'unexpected' }, { status: 500 }),
      [route(GLOBEX, 'merge')]: () =>
        Response.json({
          changes: changes([ACME], { removedOrganizationIds: [GLOBEX.id] }),
        }),
    }),
  );

  await page.getByRole('button', { name: 'Fusionner avec…' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Organisation' }).fill('Globex');
  await page.getByRole('option', { name: 'Globex' }).click();
  await dialog.getByRole('radiogroup').getByText('Acme', { exact: true }).click();
  await expect
    .element(dialog)
    .toHaveTextContent("Aucun Contact ne change d'Organisation. Globex est supprimée.");
  await dialog.getByRole('button', { name: 'Fusionner' }).click();

  await expect.poll(() => api.sent(route(GLOBEX, 'merge'))).toHaveLength(1);
  expect(api.sent(route(GLOBEX, 'merge'))[0]?.body).toEqual({ intoId: ACME.id });
  await expect.element(page.getByRole('heading', { level: 1, name: 'Acme' })).toBeVisible();
});

test('an Organization with a Contact cannot be deleted', async () => {
  await desktop();
  await openOrganization(ACME);

  await expect.element(page.getByRole('heading', { level: 1, name: 'Acme' })).toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Renommer' })).toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Supprimer…' })).not.toBeInTheDocument();
});

test('an Organization without a Contact is deleted once confirmed', async () => {
  await desktop();
  const { api } = await openOrganization(GLOBEX);

  await page.getByRole('button', { name: 'Supprimer…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Supprimer Globex ?' });
  await expect.element(dialog).toHaveTextContent("Aucun Contact n'en fait partie.");
  await dialog.getByRole('button', { name: 'Supprimer' }).click();

  await expect.poll(() => api.sent(route(GLOBEX, 'delete'))).toHaveLength(1);
  await expect.element(page.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();
  await expect.element(page.getByText('Organisation supprimée : Globex')).toBeVisible();
});

test('on mobile, the page is read only', async () => {
  await page.viewport(390, 844);
  await openOrganization(ACME);

  await expect.element(page.getByRole('heading', { level: 1, name: 'Acme' })).toBeVisible();
  await expect
    .element(page.getByRole('listitem').filter({ hasText: 'Julie Martin' }))
    .toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Renommer' })).not.toBeInTheDocument();
  await expect.element(page.getByRole('button', { name: /Passer en/ })).not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Fusionner avec…' }))
    .not.toBeInTheDocument();
});

test('an Organization nobody has says so', async () => {
  await desktop();
  await openOrganization({ id: '01990000-0000-7000-8000-0000000000ff' });

  await expect.element(page.getByText("Cette Organisation n'existe pas ou plus.")).toBeVisible();
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing on the page of an Organization nor in its merge, in the %s theme',
  async (scheme) => {
    await desktop();
    await commands.emulateColorScheme(scheme);
    await openOrganization(ACME_TYPO);
    await expect.element(page.getByRole('heading', { level: 1, name: 'Acmé' })).toBeVisible();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');
    await expectNoAxeViolations();

    await page.getByRole('button', { name: 'Fusionner avec…' }).click();
    await page.getByRole('dialog').getByRole('combobox', { name: 'Organisation' }).fill('Acme');
    await page.getByRole('option', { name: 'Acme' }).click();
    await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
    await expect.element(page.getByRole('dialog')).toHaveTextContent('Acmé est supprimée.');

    await expectNoAxeViolations();
  },
);
