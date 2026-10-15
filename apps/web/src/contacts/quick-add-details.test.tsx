import { expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const desktop = () => page.viewport(1280, 800);

const CAPGEMINI = {
  id: '01990000-0000-7000-8000-000000000021',
  name: 'Capgemini',
  type: 'consultancy',
};
const SOCIETE_GENERALE = {
  id: '01990000-0000-7000-8000-000000000022',
  name: 'Société Générale',
  type: 'end_client',
};
const SOPRA = {
  id: '01990000-0000-7000-8000-000000000023',
  name: 'Sopra Steria',
  type: 'consultancy',
};
const ORGANIZATIONS = [CAPGEMINI, SOCIETE_GENERALE];

const contactRow = (fields: Record<string, unknown>) => ({
  id: '01990000-0000-7000-8000-000000000001',
  name: 'Jean Dupont',
  status: 'pool',
  stageId: null,
  organizationId: null,
  jobTitle: null,
  email: null,
  phone: null,
  linkedinUrl: null,
  lastInteractionAt: '2026-01-06T09:00:00.000Z',
  lastInteractionOn: '2026-01-06',
  followUp: null,
  prospectingActionDays: [],
  ...fields,
});

/** Jean Dupont, at Capgemini, already in the summary. */
const JEAN = contactRow({
  organizationId: CAPGEMINI.id,
  email: 'jean.dupont@example.com',
  phone: '06 12 34 56 78',
  linkedinUrl: 'https://linkedin.com/in/jean-dupont',
});
const PAUL = contactRow({ id: '01990000-0000-7000-8000-000000000003', name: 'Paul Durand' });

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';

/** An API that knows Jean and these Organizations, and adds Paul with what the gesture answers. */
const quickAddApi = (routes: Parameters<typeof fakeApi>[0] = {}) =>
  fakeApi({
    'GET /api/summary': () =>
      Response.json({ contacts: [JEAN], stages: [], organizations: ORGANIZATIONS }),
    'POST /api/contacts': () =>
      Response.json(
        {
          changes: {
            contacts: [PAUL],
            removedContactIds: [],
            organizations: [],
            removedOrganizationIds: [],
            positionings: [],
            removedPositioningIds: [],
          },
          undoToken: UNDO_TOKEN,
        },
        { status: 201 },
      ),
    ...routes,
  });

/** Contacts, once the summary is read, with the quick add opened by `N`. */
async function openQuickAdd(api = quickAddApi()) {
  await desktop();
  const rendered = await renderApp('/contacts', api);
  await expect.element(rendered.screen.getByText('Jean Dupont')).toBeVisible();
  await userEvent.keyboard('n');
  const dialog = rendered.screen.getByRole('dialog', { name: 'Ajouter un Contact' });
  await expect.element(dialog.getByRole('textbox', { name: 'Nom' })).toHaveFocus();
  return { ...rendered, dialog };
}

const organizationField = (dialog: ReturnType<typeof page.getByRole>) =>
  dialog.getByRole('combobox', { name: 'Organisation' });

/** Types an Organization, then leaves its field as a User does: the list it opened closes. */
async function typeOrganization(dialog: ReturnType<typeof page.getByRole>, text: string) {
  await organizationField(dialog).fill(text);
  await userEvent.keyboard('{Tab}');
  await expect.element(page.getByRole('listbox')).not.toBeInTheDocument();
}

test('an Organization is chosen in a list filtered as it is typed, case, accents and spaces aside', async () => {
  const { dialog, screen, api } = await openQuickAdd();
  await dialog.getByRole('textbox', { name: 'Nom' }).fill('Paul Durand');

  await organizationField(dialog).fill('societe gen');
  const options = screen.getByRole('listbox').getByRole('option');
  await expect.element(options.first()).toHaveTextContent('Société Générale');
  expect(options.elements()).toHaveLength(1);
  await options.first().click();
  await expect.element(organizationField(dialog)).toHaveValue('Société Générale');
  // An existing Organization asks for no type.
  await expect.element(dialog.getByRole('radiogroup', { name: /Type/ })).not.toBeInTheDocument();
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect.element(screen.getByText('Paul Durand est ajouté au Vivier')).toBeVisible();
  expect(api.sent('POST /api/contacts')).toEqual([
    {
      route: 'POST /api/contacts',
      body: { name: 'Paul Durand', status: 'pool', organizationId: SOCIETE_GENERALE.id },
    },
  ]);
});

test('an Organization typed in full is the existing one, however it is written', async () => {
  const { dialog, api } = await openQuickAdd();
  await dialog.getByRole('textbox', { name: 'Nom' }).fill('Paul Durand');

  await typeOrganization(dialog, ' CAP gemini');
  await expect.element(dialog.getByRole('radiogroup', { name: /Type/ })).not.toBeInTheDocument();
  await dialog.getByRole('textbox', { name: 'Nom' }).click();
  await userEvent.keyboard('{Enter}');

  await expect.poll(() => api.sent('POST /api/contacts')).toHaveLength(1);
  expect(api.sent('POST /api/contacts')[0]?.body).toMatchObject({ organizationId: CAPGEMINI.id });
});

test('a new Organization is created with its type, which must be chosen, and joins the summary', async () => {
  const { dialog, screen, api } = await openQuickAdd(
    quickAddApi({
      'POST /api/contacts': () =>
        Response.json(
          {
            changes: {
              contacts: [{ ...PAUL, organizationId: SOPRA.id }],
              removedContactIds: [],
              organizations: [SOPRA],
              removedOrganizationIds: [],
              positionings: [],
              removedPositioningIds: [],
            },
            undoToken: UNDO_TOKEN,
          },
          { status: 201 },
        ),
    }),
  );
  await dialog.getByRole('textbox', { name: 'Nom' }).fill('Paul Durand');
  await typeOrganization(dialog, 'Sopra Steria');
  const type = dialog.getByRole('radiogroup', { name: 'Type de la nouvelle Organisation' });
  await expect.element(type).toBeVisible();
  await expect.element(dialog.getByRole('radio', { name: 'ESN' })).not.toBeChecked();
  await expect.element(dialog.getByRole('radio', { name: 'Client final' })).not.toBeChecked();

  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect
    .element(dialog.getByText('Choisis le type de cette nouvelle Organisation.'))
    .toBeVisible();
  expect(api.sent('POST /api/contacts')).toEqual([]);

  await type.getByText('ESN', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect.element(screen.getByText('Paul Durand est ajouté au Vivier')).toBeVisible();
  expect(api.sent('POST /api/contacts')).toEqual([
    {
      route: 'POST /api/contacts',
      body: {
        name: 'Paul Durand',
        status: 'pool',
        newOrganization: { name: 'Sopra Steria', type: 'consultancy' },
      },
    },
  ]);
  // The Organization came with the answer: the next quick add offers it.
  await expect.element(dialog).not.toBeInTheDocument();
  await userEvent.keyboard('n');
  await expect.element(dialog.getByRole('textbox', { name: 'Nom' })).toHaveFocus();
  await organizationField(dialog).fill('sopra');
  await expect
    .element(screen.getByRole('listbox').getByRole('option', { name: 'Sopra Steria' }))
    .toBeVisible();
});

test('the same LinkedIn profile blocks the addition while it is typed, and offers to open their record', async () => {
  const { dialog, screen, api, router } = await openQuickAdd();
  await dialog.getByRole('textbox', { name: 'Nom' }).fill('J. Dupont');

  await dialog
    .getByRole('textbox', { name: 'URL LinkedIn' })
    .fill('www.linkedin.com/in/jean-dupont/');

  const alert = dialog.getByRole('alert');
  await expect.element(alert).toHaveTextContent('Ce Contact existe déjà : Jean Dupont · Capgemini');
  await dialog.getByRole('textbox', { name: 'URL LinkedIn' }).click();
  await userEvent.keyboard('{Enter}');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
  expect(api.sent('POST /api/contacts')).toEqual([]);

  await dialog.getByRole('button', { name: 'Ouvrir sa fiche' }).click();

  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  expect(router.state.location.search).toEqual({ contact: JEAN.id });
  await expect.element(screen.getByRole('region', { name: 'Jean Dupont' })).toBeVisible();
});

test('an address that is no LinkedIn profile is refused on adding', async () => {
  const { dialog, api } = await openQuickAdd();
  await dialog.getByRole('textbox', { name: 'Nom' }).fill('Paul Durand');
  await dialog.getByRole('textbox', { name: 'URL LinkedIn' }).fill('paul durand');

  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect
    .element(
      dialog.getByText("Saisis l'adresse d'un profil LinkedIn, comme linkedin.com/in/jean-dupont."),
    )
    .toBeVisible();
  expect(api.sent('POST /api/contacts')).toEqual([]);
});

test('the same name, e-mail or phone is said discreetly, and the addition goes ahead', async () => {
  const { dialog, screen, api } = await openQuickAdd();

  await dialog.getByRole('textbox', { name: 'Nom' }).fill('jean  DUPONT');
  await expect
    .element(dialog.getByText('Un Contact porte déjà ce nom : Jean Dupont · Capgemini'))
    .toBeVisible();
  await typeOrganization(dialog, 'Capgemini');
  await expect
    .element(dialog.getByText('Un Contact porte déjà ce nom chez Capgemini'))
    .toBeVisible();
  // Only worth knowing: no error.
  expect(dialog.getByRole('alert').elements()).toEqual([]);

  await dialog.getByRole('button', { name: 'Plus de champs' }).click();
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill('JEAN.dupont@example.com');
  await dialog.getByRole('textbox', { name: 'Téléphone' }).fill('06.12.34.56.78');
  await expect
    .element(dialog.getByText('Cet e-mail est déjà celui de Jean Dupont · Capgemini'))
    .toBeVisible();
  await expect
    .element(dialog.getByText('Ce téléphone est déjà celui de Jean Dupont · Capgemini'))
    .toBeVisible();
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect.element(screen.getByText('Paul Durand est ajouté au Vivier')).toBeVisible();
  expect(api.sent('POST /api/contacts')).toHaveLength(1);
});

test('“More fields” opens the job title, e-mail, phone and note, sent trimmed when filled', async () => {
  const { dialog, api } = await openQuickAdd();
  await expect.element(dialog.getByRole('textbox', { name: 'Poste' })).not.toBeInTheDocument();
  await dialog.getByRole('textbox', { name: 'Nom' }).fill('Paul Durand');
  await dialog.getByRole('textbox', { name: 'URL LinkedIn' }).fill(' linkedin.com/in/paul ');

  const more = dialog.getByRole('button', { name: 'Plus de champs' });
  await more.click();
  await expect.element(dialog.getByRole('textbox', { name: 'Poste' })).toHaveFocus();
  await dialog.getByRole('textbox', { name: 'Poste' }).fill(' Business manager ');
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill('paul@example.com');
  await dialog.getByRole('textbox', { name: 'Note' }).fill('Met at Devoxx');
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect.poll(() => api.sent('POST /api/contacts')).toHaveLength(1);
  expect(api.sent('POST /api/contacts')[0]?.body).toEqual({
    name: 'Paul Durand',
    status: 'pool',
    linkedinUrl: 'linkedin.com/in/paul',
    jobTitle: 'Business manager',
    email: 'paul@example.com',
    note: 'Met at Devoxx',
  });
});

test('a profile taken on another device meanwhile: the summary is read again, and the duplicate shows', async () => {
  let summaries = 0;
  const { dialog, api } = await openQuickAdd(
    quickAddApi({
      'GET /api/summary': () => {
        summaries += 1;
        const paul = contactRow({ ...PAUL, linkedinUrl: 'https://linkedin.com/in/paul' });
        return Response.json({
          contacts: summaries === 1 ? [JEAN] : [JEAN, paul],
          stages: [],
          organizations: ORGANIZATIONS,
        });
      },
      'POST /api/contacts': () =>
        Response.json({ error: 'linkedin_url_taken', contactId: PAUL.id }, { status: 409 }),
    }),
  );
  await dialog.getByRole('textbox', { name: 'Nom' }).fill('P. Durand');
  await dialog.getByRole('textbox', { name: 'URL LinkedIn' }).fill('linkedin.com/in/paul');

  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect.poll(() => api.sent('GET /api/summary').length).toBe(2);
  await expect
    .element(dialog.getByRole('alert'))
    .toHaveTextContent('Ce Contact existe déjà : Paul Durand');
});

test('an Organization created on another device meanwhile: said so, and chosen instead', async () => {
  let summaries = 0;
  const { dialog, api } = await openQuickAdd(
    quickAddApi({
      'GET /api/summary': () => {
        summaries += 1;
        return Response.json({
          contacts: [JEAN],
          stages: [],
          organizations: summaries === 1 ? ORGANIZATIONS : [...ORGANIZATIONS, SOPRA],
        });
      },
      'POST /api/contacts': () => Response.json({ error: 'organization_taken' }, { status: 409 }),
    }),
  );
  await dialog.getByRole('textbox', { name: 'Nom' }).fill('Paul Durand');
  await typeOrganization(dialog, 'Sopra Steria');
  await dialog
    .getByRole('radiogroup', { name: 'Type de la nouvelle Organisation' })
    .getByText('ESN', { exact: true })
    .click();

  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect
    .element(dialog.getByRole('alert'))
    .toHaveTextContent('Cette Organisation existe déjà');
  await expect.poll(() => api.sent('GET /api/summary').length).toBe(2);
  await expect.element(dialog.getByRole('radiogroup', { name: /Type/ })).not.toBeInTheDocument();
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing on the quick add with all its fields and its checks, in the %s theme',
  async (scheme) => {
    await commands.emulateColorScheme(scheme);
    const { dialog } = await openQuickAdd();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');

    await dialog.getByRole('textbox', { name: 'Nom' }).fill('Jean Dupont');
    await typeOrganization(dialog, 'Nouvelle');
    await dialog.getByRole('button', { name: 'Plus de champs' }).click();
    await dialog.getByRole('textbox', { name: 'URL LinkedIn' }).fill('linkedin.com/in/jean-dupont');
    await expect.element(dialog.getByRole('alert')).toBeVisible();
    await expect.poll(() => document.getAnimations().length).toBe(0);
    await expectNoAxeViolations();
  },
);
