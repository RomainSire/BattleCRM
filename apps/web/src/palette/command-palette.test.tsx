import { addDays, localDay } from '@battlecrm/domain';
import { expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';

import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { contact, DEVICE_TIME_ZONE, organization, stage, summary } from '../../test/summary.ts';
import type { SummaryContact } from '../summary.ts';

const desktop = () => page.viewport(1280, 800);

const today = () => localDay(new Date(), DEVICE_TIME_ZONE);

const OUTREACH = stage({ id: '01990000-0000-7000-8000-000000000011', name: 'Approche' });
const CAPGEMINI = organization({ id: '01990000-0000-7000-8000-000000000031', name: 'Capgemini' });

const prospecting = (fields: Partial<SummaryContact>) =>
  contact({ status: 'prospecting', stageId: OUTREACH.id, ...fields });

/** Julie: Follow-up 1 overdue by two days, at Capgemini. */
const julie = () =>
  prospecting({
    id: '01990000-0000-7000-8000-000000000001',
    name: 'Julie Martin',
    organizationId: CAPGEMINI.id,
    followUp: { dueOn: addDays(today(), -2), note: null, rank: 1 },
  });
/** Inès: an Ally five days past the Rhythm of 28 days. */
const ines = () =>
  contact({
    id: '01990000-0000-7000-8000-000000000002',
    name: 'Inès Moreau',
    status: 'ally',
    lastInteractionOn: addDays(today(), -33),
    lastDoneInteractionOn: addDays(today(), -33),
  });
/** Marc: in the Pool, nothing to handle. */
const marc = () =>
  contact({ id: '01990000-0000-7000-8000-000000000003', name: 'Marc Leroy', status: 'pool' });

const withContacts = (...contacts: SummaryContact[]) =>
  fakeApi({
    'GET /api/summary': () =>
      Response.json(summary({ stages: [OUTREACH], organizations: [CAPGEMINI], contacts })),
  });

const optionNames = (listbox: ReturnType<typeof page.getByRole>) =>
  listbox
    .getByRole('option')
    .elements()
    .map((option) => option.getAttribute('aria-label') ?? option.textContent?.trim());

test('Ctrl K opens the palette on what is to handle, the longest overdue first', async () => {
  await desktop();
  const { screen } = await renderApp('/today', withContacts(julie(), ines(), marc()));
  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();

  await userEvent.keyboard('{Control>}k{/Control}');

  const palette = screen.getByRole('dialog', { name: 'Palette de commandes' });
  await expect.element(palette).toBeVisible();
  await expect.element(palette.getByRole('searchbox')).toHaveFocus();
  const options = palette.getByRole('option');
  await expect.element(options.first()).toHaveTextContent(/Inès Moreau/);
  expect(options.elements()).toHaveLength(2);
  await expect.element(options.nth(1)).toHaveTextContent(/Julie Martin/);
});

const openPalette = async (screen: Awaited<ReturnType<typeof renderApp>>['screen']) => {
  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();
  await userEvent.keyboard('{Control>}k{/Control}');
  const palette = screen.getByRole('dialog', { name: 'Palette de commandes' });
  await expect.element(palette.getByRole('searchbox')).toHaveFocus();
  return palette;
};

/**
 * Waits until the field points at a choice that is there. Once something is typed, React Aria moves
 * `aria-activedescendant` only 500 ms later, for screen readers: until then it may name a choice the
 * list just dropped, which axe would rightly report.
 */
const activeChoiceShown = async (palette: ReturnType<typeof page.getByRole>) => {
  const field = palette.getByRole('searchbox').element();
  await expect
    .poll(() => {
      const id = field.getAttribute('aria-activedescendant');
      return id === null || document.getElementById(id) !== null;
    })
    .toBe(true);
};

test('a Contact first: → shows its actions by its Status, ⌫ goes back, Enter opens one', async () => {
  await desktop();
  const { screen, router } = await renderApp('/today', withContacts(julie(), ines(), marc()));
  const palette = await openPalette(screen);

  await userEvent.keyboard('jul');
  await expect.element(palette.getByRole('option', { name: /Julie Martin/ })).toBeVisible();
  await userEvent.keyboard('{ArrowDown}{ArrowRight}');

  await expect
    .element(palette.getByRole('searchbox', { name: 'Actions sur Julie Martin' }))
    .toHaveValue('');
  expect(optionNames(palette.getByRole('listbox'))).toEqual([
    'Ouvrir la fiche',
    'Relancer…',
    'A répondu…',
    'Utiliser un Positionnement',
    'Noter une Interaction',
    'Modifier la Relance',
    "Changer d'Étape…",
    'Remettre au Vivier…',
    'Ajouter au Cercle…',
    'Archiver…',
    "Changer d'État…",
    "Ouvrir l'Organisation",
  ]);

  await userEvent.keyboard('{Backspace}');
  await expect.element(palette.getByRole('searchbox')).toHaveValue('jul');
  await userEvent.keyboard('{ArrowDown}{Tab}');
  await userEvent.keyboard('relancer');
  await expect.element(palette.getByRole('option')).toHaveTextContent('Relancer…');
  await userEvent.keyboard('{ArrowDown}{Enter}');

  await expect.element(palette).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe(`/contacts/${julie().id}`);
  expect(router.state.location.search).toEqual({ followUp: 'do' });
});

test('an Ally gets Check in…, never Add to Circle…', async () => {
  await desktop();
  const { screen } = await renderApp('/today', withContacts(julie(), ines(), marc()));
  const palette = await openPalette(screen);

  await userEvent.keyboard('ines');
  await userEvent.keyboard('{ArrowDown}{Tab}');

  const actions = optionNames(palette.getByRole('listbox'));
  expect(actions).toContain('Prendre des nouvelles…');
  expect(actions).toContain('Faire entrer…');
  expect(actions).not.toContain('Ajouter au Cercle…');
  expect(actions).not.toContain('Noter une Interaction');
});

test('Enter on a Contact opens its record as a page', async () => {
  await desktop();
  const { screen, router } = await renderApp('/today', withContacts(julie(), ines(), marc()));
  await openPalette(screen);

  await userEvent.keyboard('marc');
  await userEvent.keyboard('{ArrowDown}{Enter}');

  await expect.element(screen.getByRole('heading', { level: 1, name: /Marc Leroy/ })).toBeVisible();
  expect(router.state.location.pathname).toBe(`/contacts/${marc().id}`);
});

test.each([
  ['relancer jul', 'Relancer… · Julie Martin', { followUp: 'do' }],
  ['nouvelles ines', 'Prendre des nouvelles… · Inès Moreau', { interaction: 'check-in' }],
  ['cercle jul', 'Ajouter au Cercle… · Julie Martin', { statusTo: 'ally' }],
  ['entrer marc', 'Faire entrer… · Marc Leroy', { statusTo: 'prospecting' }],
  ['archiver marc', 'Archiver… · Marc Leroy', { statusTo: 'archived' }],
  ['vivier jul', 'Remettre au Vivier… · Julie Martin', { statusTo: 'pool' }],
])('a verb first: “%s” offers %s', async (typed, offered, search) => {
  await desktop();
  const { screen, router } = await renderApp('/today', withContacts(julie(), ines(), marc()));
  const palette = await openPalette(screen);

  await userEvent.keyboard(typed);
  const actions = palette.getByRole('listbox').getByRole('group', { name: 'Actions' });
  await expect.element(actions.getByRole('option').first()).toHaveTextContent(offered);
  await actions.getByRole('option').first().click();

  expect(router.state.location.search).toEqual(search);
});

test('never offers the verb of the current Status', async () => {
  await desktop();
  const { screen } = await renderApp('/today', withContacts(julie(), ines(), marc()));
  const palette = await openPalette(screen);

  await userEvent.keyboard('vivier marc');

  await expect.element(palette.getByRole('option').first()).toBeVisible();
  await expect.element(palette.getByRole('group', { name: 'Actions' })).not.toBeInTheDocument();
});

test('while typing, groups of Contacts, Organizations, Go to and more', async () => {
  await desktop();
  const { screen, router } = await renderApp('/today', withContacts(julie(), ines(), marc()));
  const palette = await openPalette(screen);

  await userEvent.keyboard('capg');
  // Julie is found by her Organization, Capgemini by its name.
  await expect
    .element(palette.getByRole('group', { name: 'Contacts' }).getByRole('option'))
    .toHaveTextContent(/Julie Martin/);
  await expect
    .element(palette.getByRole('group', { name: 'Organisations' }).getByRole('option'))
    .toHaveTextContent('Capgemini');

  await userEvent.clear(palette.getByRole('searchbox'));
  await userEvent.keyboard('battles');
  await palette
    .getByRole('group', { name: 'Aller à' })
    .getByRole('option', { name: 'Battles' })
    .click();
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Battles' })).toBeVisible();
  expect(router.state.location.pathname).toBe('/battles');
});

test('without a result, offers to add the name as a Contact', async () => {
  await desktop();
  const { screen } = await renderApp('/today', withContacts(julie(), ines(), marc()));
  const palette = await openPalette(screen);

  await userEvent.keyboard('Zoé Lambert');
  await expect
    .element(palette.getByRole('option'))
    .toHaveTextContent('Ajouter « Zoé Lambert » comme Contact');
  await userEvent.keyboard('{ArrowDown}{Enter}');

  const quickAdd = screen.getByRole('dialog', { name: 'Ajouter un Contact' });
  await expect.element(quickAdd.getByRole('textbox', { name: /Nom/ })).toHaveValue('Zoé Lambert');
});

test('“/”, the search of the menu and, on a phone, the magnifier open the palette', async () => {
  await desktop();
  const { screen } = await renderApp('/today', withContacts(julie()));
  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();
  const palette = screen.getByRole('dialog', { name: 'Palette de commandes' });

  await userEvent.keyboard('/');
  await expect.element(palette.getByRole('searchbox')).toHaveValue('');
  await userEvent.keyboard('{Escape}');
  await expect.element(palette).not.toBeInTheDocument();

  await screen.getByRole('button', { name: /Rechercher…/ }).click();
  await expect.element(palette).toBeVisible();
  await userEvent.keyboard('{Escape}');

  await page.viewport(390, 800);
  await screen.getByRole('button', { name: 'Rechercher…' }).click();
  await expect.element(palette.getByRole('searchbox')).toHaveFocus();
});

test('G then a letter goes to a screen, with “G …” shown while it waits', async () => {
  await desktop();
  const { screen, router } = await renderApp('/today', withContacts(julie()));
  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();

  await userEvent.keyboard('g');
  await expect.element(screen.getByRole('status').getByText('G …')).toBeVisible();
  await userEvent.keyboard('c');
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Contacts' })).toBeVisible();
  expect(router.state.location.pathname).toBe('/contacts');
  await expect.element(screen.getByText('G …')).not.toBeInTheDocument();

  for (const [letter, path] of [
    ['e', '/circle'],
    ['f', '/funnel'],
    ['b', '/battles'],
    ['p', '/positionings'],
    ['i', '/insights'],
    ['r', '/settings'],
    ['a', '/today'],
  ] as const) {
    await userEvent.keyboard(`g${letter}`);
    await expect.poll(() => router.state.location.pathname).toBe(path);
  }
});

test('“?” opens the help of the shortcuts', async () => {
  await desktop();
  const { screen } = await renderApp('/today', withContacts(julie()));
  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();

  await userEvent.keyboard('?');

  const help = screen.getByRole('dialog', { name: 'Raccourcis' });
  await expect.element(help.getByRole('heading', { name: 'Aller à' })).toBeVisible();
  await expect.element(help.getByText('Indicateurs')).toBeVisible();
});

test('no single-key shortcut fires in a field, nor once they are turned off', async () => {
  await desktop();
  const { screen, router } = await renderApp(
    '/contacts',
    fakeApi({
      'GET /api/summary': () =>
        Response.json(summary({ contacts: [julie()], settings: { singleKeyShortcuts: false } })),
    }),
  );
  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();

  await userEvent.keyboard('gf/?');
  expect(router.state.location.pathname).toBe('/contacts');
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  await expect.element(screen.getByText('G …')).not.toBeInTheDocument();

  // Ctrl K stays on, even from a field.
  await screen.getByRole('searchbox').click();
  await userEvent.keyboard('{Control>}k{/Control}');
  await expect.element(screen.getByRole('dialog', { name: 'Palette de commandes' })).toBeVisible();
});

test('typed in a field, G then a letter is only text', async () => {
  await desktop();
  const { screen, router } = await renderApp('/contacts', withContacts(julie()));
  const search = screen.getByRole('searchbox');
  await search.click();

  await userEvent.keyboard('gf');

  await expect.element(search).toHaveValue('gf');
  expect(router.state.location.pathname).toBe('/contacts');
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing in the palette nor in the help, %s theme',
  async (scheme) => {
    await desktop();
    await commands.emulateColorScheme(scheme);
    const { screen } = await renderApp('/today', withContacts(julie(), ines(), marc()));
    const palette = await openPalette(screen);
    await expect.element(palette.getByRole('option').first()).toBeVisible();
    await expectNoAxeViolations();

    await userEvent.keyboard('jul');
    await userEvent.keyboard('{ArrowDown}{ArrowRight}');
    await expect.element(palette.getByRole('option').first()).toHaveTextContent('Ouvrir la fiche');
    await activeChoiceShown(palette);
    await expectNoAxeViolations();

    await userEvent.keyboard('{Escape}');
    await expect.element(palette).not.toBeInTheDocument();
    await userEvent.keyboard('?');
    await expect.element(screen.getByRole('dialog', { name: 'Raccourcis' })).toBeVisible();
    await expectNoAxeViolations();
  },
);

test('on a phone, a Contact tapped shows its actions, “Open the record” first', async () => {
  await page.viewport(390, 800);
  const { screen, router } = await renderApp('/today', withContacts(julie(), ines(), marc()));
  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();
  await screen.getByRole('button', { name: 'Rechercher…' }).click();
  const palette = screen.getByRole('dialog', { name: 'Palette de commandes' });

  await palette.getByRole('option', { name: /Julie Martin/ }).click();
  await expect
    .element(palette.getByRole('searchbox', { name: 'Actions sur Julie Martin' }))
    .toBeVisible();
  await palette.getByRole('option', { name: 'Ouvrir la fiche' }).click();

  expect(router.state.location.pathname).toBe(`/contacts/${julie().id}`);
});
