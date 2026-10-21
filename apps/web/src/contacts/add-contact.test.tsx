import { get } from 'idb-keyval';
import { afterEach, expect, test, vi } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { changes, contact, stage, summary } from '../../test/summary.ts';
import { notify } from '../components/ui/toast.tsx';
import { DEVICE_DATA_KEY } from '../device-data.ts';
import type { SummaryContact } from '../summary.ts';

const desktop = () => page.viewport(1280, 800);

const JEAN = contact({
  id: '01990000-0000-7000-8000-000000000001',
  name: 'Jean Dupont',
  lastInteractionAt: '2026-01-06T09:00:00.000Z',
  lastInteractionOn: '2026-01-06',
});
const JULIE = contact({
  id: '01990000-0000-7000-8000-000000000002',
  name: 'Julie Martin',
  lastInteractionAt: '2026-01-05T09:00:00.000Z',
  lastInteractionOn: '2026-01-05',
});
const OUTREACH = stage({
  id: '01990000-0000-7000-8000-000000000011',
  name: 'Approche',
  aim: 'CV à envoyer',
});
const ARCHIVED = stage({
  id: '01990000-0000-7000-8000-000000000012',
  name: 'Ancienne',
  archived: true,
});
const SCREENING = stage({ id: '01990000-0000-7000-8000-000000000013', name: 'Qualif ESN' });
const STAGES = [ARCHIVED, OUTREACH, SCREENING];
const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;

/** An API that knows these Contacts, adds Jean and takes the addition back. */
const contactsApi = (contacts: SummaryContact[] = [], routes: Parameters<typeof fakeApi>[0] = {}) =>
  fakeApi({
    'GET /api/summary': () => Response.json(summary({ contacts, stages: STAGES })),
    'POST /api/contacts': () =>
      Response.json(
        {
          changes: changes({ contacts: [JEAN] }),
          undoToken: UNDO_TOKEN,
        },
        { status: 201 },
      ),
    [UNDO_ROUTE]: () =>
      Response.json({
        changes: changes({ removedContactIds: [JEAN.id] }),
      }),
    ...routes,
  });

/** The names of the list of Contacts, in the order of the screen. */
const names = (screen: { getByRole: typeof page.getByRole }) =>
  screen
    .getByRole('list', { name: 'Contacts' })
    .getByRole('listitem')
    .elements()
    .map((item) => item.querySelector('[data-slot="contact-name"]')?.textContent);

/**
 * Opens the quick add with `N` and adds Jean. Returns once the quick add has closed: while it fades
 * out, `N` opens nothing and a key may still land in its field.
 */
async function addJean(screen: Awaited<ReturnType<typeof renderApp>>['screen']) {
  await userEvent.keyboard('n');
  await screen.getByRole('textbox', { name: 'Nom' }).fill('Jean Dupont');
  await userEvent.keyboard('{Enter}');
  await expect.element(screen.getByText('Jean Dupont est ajouté au Vivier')).toBeVisible();
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
}

/** Chooses a Status in the quick add: a radio of React Aria is clicked by its label. */
const chooseStatus = (screen: { getByRole: typeof page.getByRole }, status: string) =>
  screen.getByRole('radiogroup', { name: 'État' }).getByText(status, { exact: true }).click();

/** A modal fades in: its colours are only its own once it is done. */
async function animationsEnded() {
  await expect.poll(() => document.getAnimations().length).toBe(0);
}

afterEach(() => {
  vi.useRealTimers();
});

test('Contacts says so when there is none', async () => {
  await desktop();
  const { screen } = await renderApp('/contacts', contactsApi());

  await expect.element(screen.getByText("Aucun Contact pour l'instant")).toBeVisible();
  await expect.element(screen.getByText(/seul son nom est obligatoire/)).toBeVisible();
});

test('Contacts lists them, the latest Interaction first', async () => {
  await desktop();
  const { screen } = await renderApp('/contacts', contactsApi([JULIE, JEAN]));

  const list = screen.getByRole('list', { name: 'Contacts' });
  await expect.element(list).toBeVisible();
  expect(names(screen)).toEqual(['Jean Dupont', 'Julie Martin']);
  await expect.element(list.getByText('6 janv. 2026')).toBeVisible();
  expect(list.getByText('Vivier').elements()).toHaveLength(2);
});

test('N opens the quick add, Enter adds the Contact to the Pool, and it shows in Contacts', async () => {
  await desktop();
  const { screen, api } = await renderApp('/contacts', contactsApi([JULIE]));
  await expect.element(screen.getByText('Julie Martin')).toBeVisible();

  await userEvent.keyboard('n');
  const dialog = screen.getByRole('dialog', { name: 'Ajouter un Contact' });
  await expect.element(dialog).toBeVisible();
  const name = dialog.getByRole('textbox', { name: 'Nom' });
  await expect.element(name).toHaveFocus();
  await name.fill('Jean Dupont');
  await userEvent.keyboard('{Enter}');

  await expect.element(screen.getByText('Jean Dupont est ajouté au Vivier')).toBeVisible();
  await expect.element(dialog).not.toBeInTheDocument();
  expect(api.sent('POST /api/contacts')).toEqual([
    { route: 'POST /api/contacts', body: { name: 'Jean Dupont', status: 'pool' } },
  ]);
  await expect.poll(() => names(screen)).toEqual(['Jean Dupont', 'Julie Martin']);
  // The row came with the answer of the gesture: the summary was read once.
  expect(api.sent('GET /api/summary')).toHaveLength(1);
});

test('the quick add offers Pool, Prospecting or Ally, the Pool by default, and a Stage for Prospecting only', async () => {
  await desktop();
  const { screen } = await renderApp('/contacts', contactsApi());

  await userEvent.keyboard('n');
  const dialog = screen.getByRole('dialog', { name: 'Ajouter un Contact' });
  const status = dialog.getByRole('radiogroup', { name: 'État' });
  await expect.element(status).toBeVisible();
  expect(
    status
      .getByRole('radio')
      .elements()
      .map((radio) => radio.closest('label')?.textContent),
  ).toEqual(['Vivier', 'En prospection', 'Allié']);
  await expect.element(dialog.getByRole('radio', { name: 'Vivier' })).toBeChecked();
  await expect.element(dialog.getByRole('combobox', { name: 'Étape' })).not.toBeInTheDocument();

  await chooseStatus(dialog, 'En prospection');
  const stageField = dialog.getByRole('combobox', { name: 'Étape' });
  // The Stages of the Funnel, archived ones left out, the first by default.
  await expect.element(stageField).toHaveValue(OUTREACH.id);
  expect(
    stageField
      .getByRole('option')
      .elements()
      .map((option) => option.textContent),
  ).toEqual(['Approche', 'Qualif ESN']);

  await chooseStatus(dialog, 'Allié');
  await expect.element(stageField).not.toBeInTheDocument();
});

test('added Prospecting at a chosen Stage, the Contact enters the Funnel there', async () => {
  await desktop();
  const { screen, api } = await renderApp(
    '/contacts',
    contactsApi([], {
      'POST /api/contacts': () =>
        Response.json(
          {
            changes: changes({
              contacts: [{ ...JEAN, status: 'prospecting', stageId: SCREENING.id }],
            }),
            undoToken: UNDO_TOKEN,
          },
          { status: 201 },
        ),
    }),
  );
  await expect.element(screen.getByText("Aucun Contact pour l'instant")).toBeVisible();

  await userEvent.keyboard('n');
  await screen.getByRole('textbox', { name: 'Nom' }).fill('Jean Dupont');
  await chooseStatus(screen, 'En prospection');
  await screen.getByRole('combobox', { name: 'Étape' }).selectOptions('Qualif ESN');
  await screen.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect
    .element(screen.getByText('Jean Dupont entre dans le Funnel à Qualif ESN'))
    .toBeVisible();
  expect(api.sent('POST /api/contacts')).toEqual([
    {
      route: 'POST /api/contacts',
      body: { name: 'Jean Dupont', status: 'prospecting', stageId: SCREENING.id },
    },
  ]);
  await expect
    .element(
      screen.getByRole('list', { name: 'Contacts' }).getByText('Sans Organisation · Qualif ESN'),
    )
    .toBeVisible();
});

test('a Stage gone from the Funnel meanwhile is refused: said so, the summary read again, the quick add open', async () => {
  await desktop();
  const { screen, api } = await renderApp(
    '/contacts',
    contactsApi([], {
      'POST /api/contacts': () => Response.json({ error: 'unknown_stage' }, { status: 400 }),
    }),
  );
  await expect.element(screen.getByText("Aucun Contact pour l'instant")).toBeVisible();

  await userEvent.keyboard('n');
  await screen.getByRole('textbox', { name: 'Nom' }).fill('Jean Dupont');
  await chooseStatus(screen, 'En prospection');
  await screen.getByRole('dialog').getByRole('button', { name: 'Ajouter', exact: true }).click();

  await expect
    .element(screen.getByRole('dialog').getByRole('alert'))
    .toHaveTextContent("Cette Étape n'est plus dans le Funnel : choisis-en une autre.");
  await expect.poll(() => api.sent('GET /api/summary').length).toBe(2);
});

test('added as an Ally, the Contact joins the Circle; the next opening is back on the Pool', async () => {
  await desktop();
  const { screen, api } = await renderApp(
    '/contacts',
    contactsApi([], {
      'POST /api/contacts': () =>
        Response.json(
          {
            changes: changes({ contacts: [{ ...JEAN, status: 'ally' }] }),
            undoToken: UNDO_TOKEN,
          },
          { status: 201 },
        ),
    }),
  );

  await userEvent.keyboard('n');
  await screen.getByRole('textbox', { name: 'Nom' }).fill('Jean Dupont');
  await chooseStatus(screen, 'Allié');
  await screen.getByRole('textbox', { name: 'Nom' }).click();
  await userEvent.keyboard('{Enter}');

  await expect.element(screen.getByText('Jean Dupont entre au Cercle')).toBeVisible();
  expect(api.sent('POST /api/contacts')).toEqual([
    { route: 'POST /api/contacts', body: { name: 'Jean Dupont', status: 'ally' } },
  ]);
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  await userEvent.keyboard('n');
  await expect
    .element(screen.getByRole('dialog').getByRole('radio', { name: 'Vivier' }))
    .toBeChecked();
});

test('“+ Add” in the navigation opens the same quick add, which a new opening finds empty', async () => {
  await desktop();
  const { screen } = await renderApp('/today', contactsApi());
  const add = screen.getByRole('navigation').getByRole('button', { name: /Ajouter/ });

  await add.click();
  const name = screen.getByRole('textbox', { name: 'Nom' });
  await name.fill('Jean');
  await userEvent.keyboard('{Escape}');
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  await expect.element(add).toHaveFocus();

  await add.click();
  await expect.element(screen.getByRole('textbox', { name: 'Nom' })).toHaveValue('');
});

test('a letter typed in a field is no shortcut, and a blank name adds nothing', async () => {
  await desktop();
  const { screen, api } = await renderApp('/contacts', contactsApi());
  await userEvent.keyboard('n');
  const name = screen.getByRole('textbox', { name: 'Nom' });
  await expect.element(name).toHaveFocus();
  // The key that opened the quick add is not typed into it.
  await expect.element(name).toHaveValue('');

  await userEvent.keyboard('nn ');
  await expect.element(name).toHaveValue('nn ');
  expect(screen.getByRole('dialog').elements()).toHaveLength(1);

  await name.fill('   ');
  await userEvent.keyboard('{Enter}');
  await expect.element(screen.getByText('Saisis un nom.')).toBeVisible();
  expect(api.sent('POST /api/contacts')).toEqual([]);
});

test('a refusal of the API shows as an error in the quick add, which stays open', async () => {
  await desktop();
  const { screen } = await renderApp(
    '/contacts',
    contactsApi([], { 'POST /api/contacts': () => new Response(null, { status: 500 }) }),
  );

  await userEvent.keyboard('n');
  await screen.getByRole('textbox', { name: 'Nom' }).fill('Jean Dupont');
  await userEvent.keyboard('{Enter}');

  await expect
    .element(screen.getByRole('dialog').getByRole('alert'))
    .toHaveTextContent("Quelque chose n'a pas fonctionné. Réessaie dans un instant.");
});

test('“Undo” in the notification takes the addition back on the server', async () => {
  await desktop();
  const { screen, api } = await renderApp('/contacts', contactsApi([JULIE]));
  await expect.element(screen.getByText('Julie Martin')).toBeVisible();
  await addJean(screen);

  await screen.getByRole('button', { name: /Annuler/ }).click();

  await expect.element(screen.getByText('Annulé.')).toBeVisible();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
  await expect.poll(() => names(screen)).toEqual(['Julie Martin']);
  await expect
    .element(screen.getByText('Jean Dupont est ajouté au Vivier'))
    .not.toBeInTheDocument();
});

test('Ctrl Z undoes too, but never from a field', async () => {
  await desktop();
  const { screen, api } = await renderApp('/contacts', contactsApi());
  await addJean(screen);

  await userEvent.keyboard('n');
  await expect.element(screen.getByRole('textbox', { name: 'Nom' })).toHaveFocus();
  await userEvent.keyboard('{Control>}z{/Control}');
  await userEvent.keyboard('{Escape}');
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
  expect(api.sent(UNDO_ROUTE)).toEqual([]);

  await userEvent.keyboard('{Control>}z{/Control}');
  await expect.element(screen.getByText('Annulé.')).toBeVisible();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
  await expect.element(screen.getByText("Aucun Contact pour l'instant")).toBeVisible();
});

test('an undo the server refuses says so as an error, and the summary is read again', async () => {
  await desktop();
  const { screen, api } = await renderApp(
    '/contacts',
    contactsApi([], {
      [UNDO_ROUTE]: () => Response.json({ error: 'expired' }, { status: 409 }),
    }),
  );
  await addJean(screen);

  await screen.getByRole('button', { name: /Annuler/ }).click();

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent('Ce geste ne peut plus être annulé.');
  await expect.element(screen.getByRole('button', { name: /Annuler/ })).not.toBeInTheDocument();
  await expect.poll(() => api.sent('GET /api/summary').length).toBe(2);
});

test('a notification is announced politely and stays 10 seconds', async () => {
  await desktop();
  const { screen } = await renderApp('/contacts', contactsApi());
  // Away from where a notification shows: under the pointer, it would wait.
  await userEvent.hover(screen.getByRole('heading', { level: 1 }));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });

  notify({ message: 'Jean Dupont est ajouté au Vivier' });
  await vi.advanceTimersByTimeAsync(100);
  const toast = screen.getByText('Jean Dupont est ajouté au Vivier');
  await expect.element(toast).toBeVisible();
  expect(toast.element().closest('[role="status"]')).not.toBeNull();
  await expect.element(screen.getByRole('region', { name: 'Notifications' })).toBeVisible();

  await vi.advanceTimersByTimeAsync(9_500);
  expect(toast.query()).not.toBeNull();
  await vi.advanceTimersByTimeAsync(1_000);
  await expect.element(toast).not.toBeInTheDocument();
});

test('a notification waits while it is hovered or has the focus', async () => {
  await desktop();
  const { screen } = await renderApp('/contacts', contactsApi());
  await expect.element(screen.getByText("Aucun Contact pour l'instant")).toBeVisible();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  notify({ message: 'Jean Dupont est ajouté au Vivier', undoToken: UNDO_TOKEN });
  await vi.advanceTimersByTimeAsync(100);
  const toast = screen.getByText('Jean Dupont est ajouté au Vivier');

  await userEvent.hover(toast);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(toast.query()).not.toBeNull();

  screen
    .getByRole('button', { name: /Annuler/ })
    .element()
    .focus();
  await userEvent.hover(screen.getByRole('heading', { level: 1 }));
  await vi.advanceTimersByTimeAsync(30_000);
  expect(toast.query()).not.toBeNull();

  screen.getByRole('main').element().focus();
  await vi.advanceTimersByTimeAsync(10_000);
  await expect.element(toast).not.toBeInTheDocument();
});

test('a notification that shows under the pointer waits too', async () => {
  await desktop();
  const { screen } = await renderApp('/contacts', contactsApi());
  await expect.element(screen.getByText("Aucun Contact pour l'instant")).toBeVisible();
  await userEvent.hover(screen.getByRole('heading', { level: 1 }));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  notify({ message: 'Jean Dupont est ajouté au Vivier', undoToken: UNDO_TOKEN });
  await vi.advanceTimersByTimeAsync(100);
  await userEvent.hover(screen.getByText('Jean Dupont est ajouté au Vivier'));

  notify({ message: 'Annulé.' });
  await vi.advanceTimersByTimeAsync(30_000);

  expect(screen.getByText('Annulé.').query()).not.toBeNull();
  expect(screen.getByText('Jean Dupont est ajouté au Vivier').query()).not.toBeNull();
});

const persisted = async () => JSON.stringify((await get(DEVICE_DATA_KEY)) ?? null);

test('the summary is kept on the device: Contacts still reads when the API does not answer', async () => {
  await desktop();
  const first = await renderApp('/contacts', contactsApi([JEAN]));
  await expect.element(first.screen.getByText('Jean Dupont')).toBeVisible();
  await expect.poll(persisted).toContain('Jean Dupont');
  // Only the summary: who is signed in is asked again at each page load.
  expect(await persisted()).not.toContain('jane@example.com');
  await first.screen.unmount();

  const offline = fakeApi({
    'GET /api/session': () => {
      throw new TypeError('Failed to fetch');
    },
    'GET /api/summary': () => {
      throw new TypeError('Failed to fetch');
    },
  });
  const { screen } = await renderApp('/contacts', offline);

  await expect.element(screen.getByText('Jean Dupont')).toBeVisible();
});

test('signing out erases the summary kept on the device', async () => {
  await desktop();
  const { screen } = await renderApp(
    '/contacts',
    contactsApi([JEAN], { 'POST /api/auth/sign-out': () => new Response(null, { status: 204 }) }),
  );
  await expect.element(screen.getByText('Jean Dupont')).toBeVisible();
  await expect.poll(persisted).toContain('Jean Dupont');

  await screen.getByRole('button', { name: 'Se déconnecter' }).click();

  await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await expect.poll(persisted).not.toContain('Jean Dupont');
});

test('a device whose session ended while it was closed erases what it kept', async () => {
  await desktop();
  const first = await renderApp('/contacts', contactsApi([JEAN]));
  await expect.element(first.screen.getByText('Jean Dupont')).toBeVisible();
  await expect.poll(persisted).toContain('Jean Dupont');
  await first.screen.unmount();

  const { screen } = await renderApp(
    '/contacts',
    fakeApi({
      'GET /api/session': () => Response.json({ error: 'unauthenticated' }, { status: 401 }),
    }),
  );

  await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await expect.poll(persisted).not.toContain('Jean Dupont');
});

test('without the summary, Contacts says it could not be loaded', async () => {
  await desktop();
  const { screen } = await renderApp(
    '/contacts',
    fakeApi({ 'GET /api/summary': () => new Response(null, { status: 500 }) }),
  );

  await expect
    .element(screen.getByRole('alert'))
    .toHaveTextContent("Tes Contacts n'ont pas pu être chargés. Réessaie dans un instant.");
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing on Contacts, its quick add and its notification, in the %s theme',
  async (scheme) => {
    await desktop();
    await commands.emulateColorScheme(scheme);
    const { screen } = await renderApp('/contacts', contactsApi([JULIE]));
    await expect.element(screen.getByText('Julie Martin')).toBeVisible();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');
    await expectNoAxeViolations();

    await userEvent.keyboard('n');
    await expect.element(screen.getByRole('textbox', { name: 'Nom' })).toHaveFocus();
    await animationsEnded();
    await expectNoAxeViolations();
    // The Stage shows for Prospecting, and the segment chosen takes the accent.
    await chooseStatus(screen, 'En prospection');
    await expect.element(screen.getByRole('combobox', { name: 'Étape' })).toBeVisible();
    await animationsEnded();
    await expectNoAxeViolations();
    await chooseStatus(screen, 'Vivier');

    await screen.getByRole('textbox', { name: 'Nom' }).fill('Jean Dupont');
    await userEvent.keyboard('{Enter}');
    await expect.element(screen.getByText('Jean Dupont est ajouté au Vivier')).toBeVisible();
    await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
    await animationsEnded();
    await expectNoAxeViolations();
  },
);
