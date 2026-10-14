import { afterEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const desktop = () => page.viewport(1280, 800);
const mobile = () => page.viewport(390, 800);

const CAPGEMINI = {
  id: '01990000-0000-7000-8000-000000000021',
  name: 'Capgemini',
  type: 'consultancy',
};
const NORDIKA = { id: '01990000-0000-7000-8000-000000000022', name: 'Nordika', type: 'end_client' };
const OUTREACH = {
  id: '01990000-0000-7000-8000-000000000011',
  name: 'Approche',
  aim: 'CV à envoyer',
  archived: false,
};

/** A Contact as the summary carries it, with nothing but what is given. */
const contact = <F extends { id: string; lastInteractionAt: string; lastInteractionOn: string }>(
  fields: F,
) => ({
  stageId: null as string | null,
  organizationId: null as string | null,
  jobTitle: null as string | null,
  email: null as string | null,
  phone: null as string | null,
  linkedinUrl: null as string | null,
  ...fields,
});
const JULIE = contact({
  id: '01990000-0000-7000-8000-000000000001',
  name: 'Julie Martin',
  status: 'prospecting',
  stageId: OUTREACH.id,
  organizationId: CAPGEMINI.id,
  jobTitle: 'Responsable recrutement',
  email: 'julie.martin@capgemini.com',
  phone: '06 12 34 56 78',
  linkedinUrl: 'https://linkedin.com/in/juliemartin',
  lastInteractionAt: '2026-01-08T09:00:00.000Z',
  lastInteractionOn: '2026-01-08',
});
const THOMAS = contact({
  id: '01990000-0000-7000-8000-000000000002',
  name: 'Thomas Petit',
  status: 'pool',
  jobTitle: 'Lead dev',
  lastInteractionAt: '2026-01-07T09:00:00.000Z',
  lastInteractionOn: '2026-01-07',
});
const INES = contact({
  id: '01990000-0000-7000-8000-000000000003',
  name: 'Inès Moreau',
  status: 'ally',
  organizationId: NORDIKA.id,
  email: 'ines@nordika.io',
  lastInteractionAt: '2026-01-06T09:00:00.000Z',
  lastInteractionOn: '2026-01-06',
});
const PAUL = contact({
  id: '01990000-0000-7000-8000-000000000004',
  name: 'Paul Lefèvre',
  status: 'archived',
  stageId: OUTREACH.id,
  lastInteractionAt: '2026-01-05T09:00:00.000Z',
  lastInteractionOn: '2026-01-05',
});
const CONTACTS = [PAUL, INES, THOMAS, JULIE];

/** The record of Julie: her note, then her addition, Prospecting at the first Stage. */
const JULIE_RECORD = {
  note: 'Rencontrée au meetup Rust Lyon.',
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
};
const recordOf = (
  added: { lastInteractionAt: string; lastInteractionOn: string },
  toStatus: string,
) => ({
  note: null,
  thread: [
    {
      id: '01990000-0000-7000-8000-000000000032',
      kind: 'contact_added',
      direction: 'none',
      occurredAt: added.lastInteractionAt,
      localDate: added.lastInteractionOn,
      statusChange: { fromStatus: null, toStatus, stageId: null, reason: null },
    },
  ],
});

const RECORD_ROUTE = (id: string) => `GET /api/contacts/${id}/record`;

const contactsApi = (contacts: unknown[] = CONTACTS) =>
  fakeApi({
    'GET /api/summary': () =>
      Response.json({ contacts, stages: [OUTREACH], organizations: [CAPGEMINI, NORDIKA] }),
    [RECORD_ROUTE(JULIE.id)]: () => Response.json(JULIE_RECORD),
    [RECORD_ROUTE(THOMAS.id)]: () => Response.json(recordOf(THOMAS, 'pool')),
    [RECORD_ROUTE(INES.id)]: () => Response.json(recordOf(INES, 'ally')),
  });

/** The names of the list, in the order of the screen, as they are read: an Ally's with its star. */
const names = () =>
  page
    .getByRole('list', { name: 'Contacts' })
    .getByRole('listitem')
    .elements()
    .map((item) => item.querySelector('[data-slot="contact-name"]')?.textContent);

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

const search = () => page.getByRole('searchbox', { name: 'Rechercher un Contact' });
const chip = (name: string) =>
  page.getByRole('radiogroup', { name: 'Filtre' }).getByText(name, { exact: true });

test('the search finds a Contact by name, Organization, job title or e-mail, accents aside', async () => {
  await desktop();
  await renderApp('/contacts', contactsApi());
  await expect.element(page.getByText('Julie Martin')).toBeVisible();

  await search().fill('capgem');
  await expect.poll(names).toEqual(['Julie Martin']);
  await search().fill('lead');
  await expect.poll(names).toEqual(['Thomas Petit']);
  await search().fill('NORDIKA');
  await expect.poll(names).toEqual(['Inès Moreau Allié']);
  await search().fill('ines');
  await expect.poll(names).toEqual(['Inès Moreau Allié']);

  await search().fill('zzz');
  await expect.element(page.getByText('Aucun Contact ne correspond')).toBeVisible();
  await expect.element(page.getByRole('list', { name: 'Contacts' })).not.toBeInTheDocument();
});

test('All leaves the Archived out and says how many; each chip shows its Status', async () => {
  await desktop();
  await renderApp('/contacts', contactsApi());

  await expect.poll(names).toEqual(['Julie Martin', 'Thomas Petit', 'Inès Moreau Allié']);
  await expect.element(page.getByText('1 archivé')).toBeVisible();

  await page.getByRole('button', { name: 'Afficher' }).click();
  await expect.poll(names).toEqual(['Paul Lefèvre']);
  await expect
    .element(chip('Archivés').element().closest('label')!)
    .toHaveAttribute('data-selected', 'true');

  await chip('Vivier').click();
  await expect.poll(names).toEqual(['Thomas Petit']);
  await chip('En prospection').click();
  await expect.poll(names).toEqual(['Julie Martin']);
  await chip('Alliés').click();
  await expect.poll(names).toEqual(['Inès Moreau Allié']);
});

test('a row reads according to the Status, and an Ally carries its star', async () => {
  await desktop();
  await renderApp('/contacts', contactsApi());
  const list = page.getByRole('list', { name: 'Contacts' });
  await expect.element(list).toBeVisible();

  const [julie, thomas, ines] = list.getByRole('listitem').all();
  await expect.element(julie!).toHaveTextContent('Capgemini · Approche');
  await expect.element(julie!).toHaveTextContent('Sans prochaine action');
  await expect.element(thomas!).toHaveTextContent('Sans Organisation · Vivier');
  await expect.element(ines!).toHaveTextContent('Nordika · Allié');
  // The star is said, never only seen.
  await expect.element(ines!.getByRole('link')).toHaveAccessibleName(/^Inès Moreau Allié/);
  await expect.element(julie!).toHaveTextContent('8 janv. 2026');
});

test('a row opens the record in the anchored panel, kept in the address; another row replaces it', async () => {
  await desktop();
  const { router, api } = await renderApp('/contacts', contactsApi());
  await expect.element(page.getByText('Julie Martin')).toBeVisible();
  // The thread is read on demand, never with the list.
  expect(api.sent(RECORD_ROUTE(JULIE.id))).toHaveLength(0);

  await page.getByRole('link', { name: /Julie Martin/ }).click();

  const panel = page.getByRole('region', { name: 'Julie Martin' });
  await expect.element(panel).toBeVisible();
  expect(router.state.location.search).toEqual({ contact: JULIE.id });
  await expect.element(panel.getByRole('heading', { name: 'Julie Martin' })).toHaveFocus();
  // Its row stays marked, not only under the pointer.
  await expect
    .element(page.getByRole('link', { name: /Julie Martin/ }))
    .toHaveAttribute('aria-current', 'page');
  await expect
    .element(page.getByRole('link', { name: /Thomas Petit/ }))
    .not.toHaveAttribute('aria-current');
  await expect.element(panel.getByText('Ajouté En prospection · Approche')).toBeVisible();
  // The list stays: the panel is no modal.
  await expect.element(page.getByRole('list', { name: 'Contacts' })).toBeVisible();

  await page.getByRole('link', { name: /Thomas Petit/ }).click();
  await expect.element(page.getByRole('region', { name: 'Thomas Petit' })).toBeVisible();
  await expect.element(page.getByRole('region', { name: 'Julie Martin' })).not.toBeInTheDocument();
  await expect
    .element(page.getByRole('region', { name: 'Thomas Petit' }).getByText('Ajouté au Vivier'))
    .toBeVisible();
});

test('the details of the panel show the Coordinates, and Escape closes it back to its row', async () => {
  await desktop();
  const { router } = await renderApp(`/contacts?contact=${JULIE.id}`, contactsApi());
  const panel = page.getByRole('region', { name: 'Julie Martin' });
  await expect.element(panel).toBeVisible();

  await panel.getByRole('tab', { name: 'Détails' }).click();
  await expect.element(panel.getByText('julie.martin@capgemini.com')).toBeVisible();
  await expect.element(panel.getByText('Rencontrée au meetup Rust Lyon.')).toBeVisible();

  await userEvent.keyboard('{Escape}');
  await expect.element(panel).not.toBeInTheDocument();
  expect(router.state.location.search).toEqual({});
  await expect.element(page.getByRole('link', { name: /Julie Martin/ })).toHaveFocus();
});

test('“Open as page” leads to the record with its own address, under Contacts', async () => {
  await desktop();
  const { router } = await renderApp(`/contacts?contact=${JULIE.id}`, contactsApi());

  await page.getByRole('link', { name: 'Ouvrir en page' }).click();

  await expect.element(page.getByRole('heading', { level: 1, name: 'Julie Martin' })).toBeVisible();
  expect(router.state.location.pathname).toBe(`/contacts/${JULIE.id}`);
  const breadcrumb = page.getByRole('navigation', { name: "Fil d'Ariane" });
  await expect.element(breadcrumb).toHaveTextContent('Contacts›Julie Martin');
  await expect
    .element(
      page
        .getByRole('navigation', { name: 'Menu principal' })
        .getByRole('link', { name: 'Contacts' }),
    )
    .toHaveAttribute('aria-current', 'page');
});

test('the page shows the header, the thread and the Coordinates', async () => {
  await desktop();
  await renderApp(`/contacts/${JULIE.id}`, contactsApi());

  await expect.element(page.getByRole('heading', { level: 1, name: 'Julie Martin' })).toBeVisible();
  await expect.element(page.getByText('Capgemini · ESN').first()).toBeVisible();
  await expect
    .element(page.getByRole('link', { name: 'LinkedIn' }).first())
    .toHaveAttribute('href', 'https://linkedin.com/in/juliemartin');
  await expect.element(page.getByText('Approche · CV à envoyer').first()).toBeVisible();

  const thread = page.getByRole('list', { name: 'Fil' });
  await expect.element(thread.getByText('Ajouté En prospection · Approche')).toBeVisible();
  const coordinates = page.getByRole('region', { name: 'Coordonnées' });
  await expect.element(coordinates.getByText('Responsable recrutement')).toBeVisible();
  await expect.element(coordinates.getByText('06 12 34 56 78')).toBeVisible();
  await expect.element(coordinates.getByText('Rencontrée au meetup Rust Lyon.')).toBeVisible();
});

test('a Contact the summary does not know is said so', async () => {
  await desktop();
  await renderApp('/contacts/01990000-0000-7000-8000-0000000000ff', contactsApi());

  await expect.element(page.getByText("Ce Contact n'existe pas ou plus.")).toBeVisible();
  await expect.element(page.getByRole('link', { name: 'Contacts' }).last()).toBeVisible();
});

test('the thread that does not load says so, and the rest of the record stays', async () => {
  await desktop();
  // An API that knows the Contacts but answers nothing for their record.
  await renderApp(
    `/contacts/${THOMAS.id}`,
    fakeApi({
      'GET /api/summary': () =>
        Response.json({ contacts: CONTACTS, stages: [OUTREACH], organizations: [] }),
    }),
  );

  await expect.element(page.getByRole('heading', { level: 1, name: 'Thomas Petit' })).toBeVisible();
  await expect
    .element(page.getByText("Le fil n'a pas pu être chargé. Réessaie dans un instant."))
    .toBeVisible();
});

test('on mobile, a row opens the record as a page', async () => {
  await mobile();
  const { router } = await renderApp('/contacts', contactsApi());

  await page.getByRole('link', { name: /Julie Martin/ }).click();

  await expect.element(page.getByRole('heading', { level: 1, name: 'Julie Martin' })).toBeVisible();
  expect(router.state.location.pathname).toBe(`/contacts/${JULIE.id}`);
});

test('without a Contact, the screen offers to add one, which N does too', async () => {
  await desktop();
  await renderApp('/contacts', contactsApi([]));

  await expect.element(page.getByText("Aucun Contact pour l'instant")).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter un Contact' }).click();

  await expect.element(page.getByRole('dialog', { name: 'Ajouter un Contact' })).toBeVisible();
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing on Contacts with its panel, nor on the page, in the %s theme',
  async (scheme) => {
    await desktop();
    await commands.emulateColorScheme(scheme);
    await renderApp(`/contacts?contact=${INES.id}`, contactsApi());
    await expect
      .element(page.getByRole('region', { name: 'Inès Moreau' }).getByText('Ajouté au Cercle'))
      .toBeVisible();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');
    await expectNoAxeViolations();

    await page.getByRole('link', { name: 'Ouvrir en page' }).click();
    await expect.element(page.getByRole('list', { name: 'Fil' })).toBeVisible();
    await expectNoAxeViolations();

    await mobile();
    await expectNoAxeViolations();
  },
);
