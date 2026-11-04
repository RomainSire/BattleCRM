import { beforeEach, describe, expect, test, vi } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import type { ContactCard, Lookup, ProfileReading } from '../messages.ts';
import {
  APP_ORIGIN,
  fakeBackground,
  fakeTab,
  renderSidebar,
  TAB,
} from '../../test/render-sidebar.tsx';
import { ADDED_LINE_MS } from './added-line.tsx';

const PASSWORD = 'correct horse battery staple';
const ELSEWHERE = 'Ouvre un profil LinkedIn pour voir ou ajouter un Contact.';

type Screen = Awaited<ReturnType<typeof renderSidebar>>['screen'];

async function fillSignIn(
  screen: Screen,
  { email = 'jane@example.com', password = PASSWORD } = {},
) {
  const emailField = screen.getByRole('textbox', { name: 'E-mail' });
  await emailField.clear();
  await emailField.fill(email);
  await screen.getByLabelText('Mot de passe', { exact: true }).fill(password);
  await screen.getByRole('button', { name: 'Se connecter' }).click();
}

async function giveCode(screen: Screen, code = '123456') {
  await screen.getByRole('textbox', { name: 'Code' }).fill(code);
  await screen.getByRole('button', { name: 'Valider' }).click();
}

const signedIn = { status: 'signedIn', email: 'jane@example.com' } as const;

// As wide as Firefox opens its sidebar.
beforeEach(() => page.viewport(360, 800));

describe('sign-in', () => {
  test('without a session, signs in by e-mail and password, then says what to open', async () => {
    const background = fakeBackground({ signIn: () => signedIn });
    const { screen } = await renderSidebar(background);

    await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await fillSignIn(screen);

    await expect.element(screen.getByText(ELSEWHERE)).toBeVisible();
    await expect.element(screen.getByText('Connecté : jane@example.com')).toBeVisible();
    expect(background.messages).toContainEqual({
      type: 'signIn',
      email: 'jane@example.com',
      password: PASSWORD,
    });
  });

  test('a wrong password or too many attempts: one message each, the fields kept', async () => {
    const background = fakeBackground({
      signIn: () => ({ status: 'refused', error: 'invalid_credentials' }),
    });
    const { screen } = await renderSidebar(background);

    await fillSignIn(screen);
    await expect
      .element(screen.getByText('Adresse e-mail ou mot de passe incorrect.'))
      .toBeVisible();
    await expect
      .element(screen.getByRole('textbox', { name: 'E-mail' }))
      .toHaveValue('jane@example.com');

    background.answer('signIn', () => ({ status: 'refused', error: 'too_many_attempts' }));
    await screen.getByRole('button', { name: 'Se connecter' }).click();
    await expect.element(screen.getByText(/Trop de tentatives/)).toBeVisible();
  });

  test('with a second factor, a code of the app or a backup code opens the session', async () => {
    const background = fakeBackground({
      signIn: () => ({ status: 'codeRequired' }),
      verifyCode: ({ code }) =>
        code === '123456' ? signedIn : { status: 'refused', error: 'invalid_code' },
    });
    const { screen } = await renderSidebar(background);

    await fillSignIn(screen);
    await expect
      .element(screen.getByRole('heading', { name: 'Double authentification' }))
      .toBeVisible();
    await giveCode(screen, '654321');
    await expect.element(screen.getByText('Code incorrect.')).toBeVisible();
    await giveCode(screen, '123456');

    await expect.element(screen.getByText(ELSEWHERE)).toBeVisible();
  });

  test('a code too late goes back to the password, which says why', async () => {
    const background = fakeBackground({
      signIn: () => ({ status: 'codeRequired' }),
      verifyCode: () => ({ status: 'refused', error: 'challenge_expired' }),
    });
    const { screen } = await renderSidebar(background);

    await fillSignIn(screen);
    await giveCode(screen);

    await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect.element(screen.getByText(/La connexion a pris trop de temps/)).toBeVisible();
  });

  test('“Back to sign-in” leaves the code', async () => {
    const { screen } = await renderSidebar(
      fakeBackground({ signIn: () => ({ status: 'codeRequired' }) }),
    );

    await fillSignIn(screen);
    await screen.getByRole('button', { name: 'Retour à la connexion' }).click();

    await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  });
});

describe('screens, in their order', () => {
  test('an expired session asks to sign in again, the address filled in', async () => {
    const { screen } = await renderSidebar(
      fakeBackground({
        session: () => ({ status: 'expired', email: 'jane@example.com' }),
        signIn: () => signedIn,
      }),
    );

    await expect.element(screen.getByText('Ta session a expiré')).toBeVisible();
    await expect
      .element(screen.getByRole('textbox', { name: 'E-mail' }))
      .toHaveValue('jane@example.com');
    await screen.getByLabelText('Mot de passe', { exact: true }).fill(PASSWORD);
    await screen.getByRole('button', { name: 'Se connecter' }).click();

    await expect.element(screen.getByText(ELSEWHERE)).toBeVisible();
  });

  test('426: the extension is to be updated, with a link to the app’s preferences', async () => {
    const { screen } = await renderSidebar(
      fakeBackground({ session: () => ({ status: 'outdated' }) }),
    );

    await expect
      .element(screen.getByRole('heading', { name: 'Extension à mettre à jour' }))
      .toBeVisible();
    await expect
      .element(screen.getByText(/about:addons › Rechercher des mises à jour/))
      .toBeVisible();
    await expect
      .element(screen.getByRole('link', { name: /Réglages › Préférences/ }))
      .toHaveAttribute('href', `${APP_ORIGIN}/settings#preferences`);
  });

  test('a 426 met while signing in shows the same screen', async () => {
    const { screen } = await renderSidebar(
      fakeBackground({ signIn: () => ({ status: 'outdated' }) }),
    );

    await fillSignIn(screen);

    await expect
      .element(screen.getByRole('heading', { name: 'Extension à mettre à jour' }))
      .toBeVisible();
  });

  test('an API that does not answer: “Try again” asks once more', async () => {
    const background = fakeBackground({ session: () => ({ status: 'unreachable' }) });
    const { screen } = await renderSidebar(background);

    await expect
      .element(screen.getByRole('heading', { name: 'BattleCRM ne répond pas' }))
      .toBeVisible();
    background.answer('session', () => signedIn);
    await screen.getByRole('button', { name: 'Réessayer' }).click();

    await expect.element(screen.getByText(ELSEWHERE)).toBeVisible();
  });

  test('“Sign out”, without confirmation, back to an empty sign-in', async () => {
    const background = fakeBackground({ session: () => signedIn });
    const { screen } = await renderSidebar(background);

    await screen.getByRole('button', { name: 'Se déconnecter' }).click();

    await expect.element(screen.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect.element(screen.getByRole('textbox', { name: 'E-mail' })).toHaveValue('');
    expect(background.messages).toContainEqual({ type: 'signOut' });
  });
});

const PROFILE = 'https://www.linkedin.com/in/ga%C3%ABtan-lef%C3%A8vre-b7c41e2d/';
/** The profile of `PROFILE`, as the sidebar asks about it: normalized. */
const ASKED = 'https://linkedin.com/in/gaëtan-lefèvre-b7c41e2d';
const OTHER = 'https://www.linkedin.com/in/camille-durand/';

const prospecting: ContactCard = {
  id: 'c-1',
  name: 'Gaëtan Lefèvre',
  status: 'prospecting',
  stageName: 'Premier message',
  organizationName: 'Acme',
  jobTitle: 'Directeur technique',
  lastDoneInteractionOn: '2026-09-12',
};
const ally: ContactCard = {
  id: 'c-2',
  name: 'Camille Durand',
  status: 'ally',
  stageName: null,
  organizationName: null,
  jobTitle: null,
  lastDoneInteractionOn: null,
};

/** A profile that is no Contact, as the background tells it, read on a page that showed nothing. */
const toAdd = (fields: Partial<Extract<Lookup, { status: 'notContact' }>> = {}): Lookup => ({
  status: 'notContact',
  reading: null,
  sameName: [],
  organizations: [],
  stages: [],
  ...fields,
});

/** Signed in; each profile answers with its card, any other with no Contact. */
const withCards = (cards: Record<string, ContactCard>) =>
  fakeBackground({
    session: () => signedIn,
    lookup: ({ url }) => {
      const contact = cards[url];
      return contact ? { status: 'contact', contact } : toAdd();
    },
  });

const lookups = (background: ReturnType<typeof fakeBackground>) =>
  background.messages.filter(({ type }) => type === 'lookup');

describe('the card of a Contact', () => {
  test('Prospecting: its name, its Status with its Stage, Organization, job, last exchange and its record', async () => {
    const background = withCards({ [ASKED]: prospecting });
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));

    await expect.element(screen.getByRole('heading', { name: 'Gaëtan Lefèvre' })).toBeVisible();
    await expect.element(screen.getByText('En prospection · Premier message')).toBeVisible();
    await expect.element(screen.getByText('Acme')).toBeVisible();
    await expect.element(screen.getByText('Directeur technique')).toBeVisible();
    await expect.element(screen.getByText('Dernier échange : 12 sept.')).toBeVisible();
    const record = screen.getByRole('link', { name: 'Ouvrir sa fiche' });
    await expect.element(record).toHaveAttribute('href', `${APP_ORIGIN}/contacts/c-1`);
    await expect.element(record).toHaveAttribute('target', '_blank');
    expect(lookups(background)).toEqual([{ type: 'lookup', url: ASKED, tabId: TAB }]);
  });

  test('an Ally: ★ by its name, no exchange yet, no Organization', async () => {
    const { screen } = await renderSidebar(withCards({ [ASKED]: ally }), fakeTab(PROFILE));

    await expect.element(screen.getByRole('heading', { name: 'Camille Durand' })).toBeVisible();
    await expect.element(screen.getByText('★')).toBeVisible();
    await expect.element(screen.getByText('Allié', { exact: true })).toBeVisible();
    await expect.element(screen.getByText('Aucun échange')).toBeVisible();
    await expect.element(screen.getByText('Sans Organisation')).toBeVisible();
  });

  test('an Archived Contact has its card like the others, and nothing changes from it', async () => {
    const { screen } = await renderSidebar(
      withCards({ [ASKED]: { ...ally, status: 'archived' } }),
      fakeTab(PROFILE),
    );

    await expect.element(screen.getByText('Archivé', { exact: true })).toBeVisible();
    expect(screen.getByText('★').query()).toBeNull();
    // Only signing out: the card is read, never changed here.
    expect(screen.getByRole('button').elements()).toHaveLength(1);
    expect(screen.getByRole('textbox').query()).toBeNull();
  });

  test('follows the active tab: one read per profile shown, never another for the same one', async () => {
    const background = withCards({
      [ASKED]: prospecting,
      'https://linkedin.com/in/camille-durand': ally,
    });
    const { screen, tab } = await renderSidebar(background, fakeTab(PROFILE));
    await expect.element(screen.getByRole('heading', { name: 'Gaëtan Lefèvre' })).toBeVisible();

    tab.go(OTHER);
    await expect.element(screen.getByRole('heading', { name: 'Camille Durand' })).toBeVisible();
    // Another page of the same profile.
    tab.go(`${OTHER}overlay/contact-info/`);
    tab.go('https://www.linkedin.com/feed/');
    await expect.element(screen.getByText(ELSEWHERE)).toBeVisible();
    tab.go(undefined);
    await expect.element(screen.getByText(ELSEWHERE)).toBeVisible();

    expect(lookups(background)).toEqual([
      { type: 'lookup', url: ASKED, tabId: TAB },
      { type: 'lookup', url: 'https://linkedin.com/in/camille-durand', tabId: TAB },
    ]);
  });

  test('an API in error: “Try again” reads the profile once more', async () => {
    const background = fakeBackground({
      session: () => signedIn,
      lookup: () => ({ status: 'error' }),
    });
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));

    await expect
      .element(screen.getByRole('heading', { name: 'BattleCRM ne répond pas' }))
      .toBeVisible();
    background.answer('lookup', () => ({ status: 'contact', contact: prospecting }));
    await screen.getByRole('button', { name: 'Réessayer' }).click();

    await expect.element(screen.getByRole('heading', { name: 'Gaëtan Lefèvre' })).toBeVisible();
  });

  test('a session that ended while reading: to sign in again, the address filled in', async () => {
    let asked = 0;
    // Signed in at first; once the read met the end of the session, the background says so.
    const background = fakeBackground({
      session: () => (asked++ === 0 ? signedIn : { status: 'expired', email: 'jane@example.com' }),
      lookup: () => ({ status: 'signedOut' }),
    });
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));

    await expect.element(screen.getByText('Ta session a expiré')).toBeVisible();
  });

  test('a 426 while reading: the extension is to be updated', async () => {
    const { screen } = await renderSidebar(
      fakeBackground({ session: () => signedIn, lookup: () => ({ status: 'outdated' }) }),
      fakeTab(PROFILE),
    );

    await expect
      .element(screen.getByRole('heading', { name: 'Extension à mettre à jour' }))
      .toBeVisible();
  });
});

/** What the page of `PROFILE` reads. */
const READING: ProfileReading = {
  name: 'Gaëtan Lefèvre',
  jobTitle: 'Gérant',
  organizationName: 'voltéo',
  email: 'gaetan.lefevre@exemple.fr',
  phone: '0611223344',
};
const VOLTEO = { id: 'o-1', name: 'VOLTÉO', type: 'end_client' } as const;
const STAGES = [
  { id: 's-1', name: 'Premier message' },
  { id: 's-2', name: 'Relance' },
];

/**
 * Signed in on a profile to add: it reads `READING`, until an addition makes it a Contact, and an
 * undo takes it back.
 */
function addable(fields: Partial<Extract<Lookup, { status: 'notContact' }>> = {}) {
  let contact: ContactCard | undefined;
  const background = fakeBackground({
    session: () => signedIn,
    lookup: () =>
      contact
        ? { status: 'contact', contact }
        : toAdd({ reading: READING, organizations: [VOLTEO], stages: STAGES, ...fields }),
    addContact: ({ contact: sent }) => {
      contact = {
        ...prospecting,
        name: sent.name,
        status: sent.status,
        stageName: sent.status === 'prospecting' ? 'Relance' : null,
        lastDoneInteractionOn: null,
      };
      return { status: 'added', undoToken: 'g-1' };
    },
    undo: () => {
      contact = undefined;
      return { status: 'undone' };
    },
  });
  return background;
}

/** A choice of a segmented control, by its text: its input is hidden. */
const choose = (screen: Screen, group: string, label: string) =>
  screen.getByRole('radiogroup', { name: group }).getByText(label, { exact: true }).click();

const added = (background: ReturnType<typeof fakeBackground>) =>
  background.messages.filter(({ type }) => type === 'addContact');

describe('the form to add a Contact', () => {
  test('filled with what the page reads; the URL shown, disabled; the note empty; in the Pool', async () => {
    const { screen } = await renderSidebar(addable(), fakeTab(PROFILE));

    await expect.element(screen.getByRole('heading', { name: 'Ajouter un Contact' })).toBeVisible();
    await expect
      .element(screen.getByRole('textbox', { name: 'Nom' }))
      .toHaveValue('Gaëtan Lefèvre');
    await expect.element(screen.getByRole('textbox', { name: 'Poste' })).toHaveValue('Gérant');
    // The same name, case and accents aside: the User's own, by its name.
    await expect
      .element(screen.getByRole('combobox', { name: 'Organisation' }))
      .toHaveValue('VOLTÉO');
    expect(screen.getByText('Type de la nouvelle Organisation').query()).toBeNull();
    await expect
      .element(screen.getByRole('textbox', { name: 'E-mail' }))
      .toHaveValue('gaetan.lefevre@exemple.fr');
    await expect
      .element(screen.getByRole('textbox', { name: 'Téléphone' }))
      .toHaveValue('0611223344');
    await expect.element(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('');
    const linkedinUrl = screen.getByRole('textbox', { name: 'URL LinkedIn' });
    await expect.element(linkedinUrl).toHaveValue(ASKED);
    await expect.element(linkedinUrl).toBeDisabled();
    await expect.element(screen.getByRole('radio', { name: 'Vivier' })).toBeChecked();
  });

  test('Enter adds it as it is, the existing Organization by its id', async () => {
    const background = addable();
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));

    await screen.getByRole('textbox', { name: 'Poste' }).fill('Gérant fondateur');
    await userEvent.keyboard('{Enter}');

    await expect.element(screen.getByText('Ajouté au Vivier')).toBeVisible();
    expect(added(background)).toEqual([
      {
        type: 'addContact',
        tabId: TAB,
        contact: {
          name: 'Gaëtan Lefèvre',
          status: 'pool',
          organizationId: VOLTEO.id,
          linkedinUrl: ASKED,
          jobTitle: 'Gérant fondateur',
          email: 'gaetan.lefevre@exemple.fr',
          phone: '0611223344',
        },
      },
    ]);
  });

  test('an Organization read that is none of the User’s: new, its type asked, none chosen', async () => {
    const background = addable({ organizations: [] });
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));

    await expect
      .element(screen.getByRole('combobox', { name: 'Organisation' }))
      .toHaveValue('voltéo');
    await expect.element(screen.getByRole('radio', { name: 'ESN' })).not.toBeChecked();
    await expect.element(screen.getByRole('radio', { name: 'Client final' })).not.toBeChecked();
    await screen.getByRole('button', { name: 'Ajouter' }).click();

    await expect
      .element(screen.getByText('Choisis le type de cette nouvelle Organisation.'))
      .toBeVisible();
    expect(added(background)).toEqual([]);
    await choose(screen, 'Type de la nouvelle Organisation', 'Client final');
    await screen.getByRole('button', { name: 'Ajouter' }).click();

    await expect.element(screen.getByText('Ajouté au Vivier')).toBeVisible();
    expect(added(background)[0]).toMatchObject({
      contact: { newOrganization: { name: 'voltéo', type: 'end_client' } },
    });
  });

  test('the name only is required; nothing read, the form is empty but for the URL', async () => {
    const background = addable({ reading: null });
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));

    await expect.element(screen.getByRole('textbox', { name: 'Nom' })).toHaveValue('');
    await expect.element(screen.getByRole('combobox', { name: 'Organisation' })).toHaveValue('');
    await screen.getByRole('button', { name: 'Ajouter' }).click();
    await expect.element(screen.getByText('Saisis un nom.')).toBeVisible();
    expect(added(background)).toEqual([]);

    await screen.getByRole('textbox', { name: 'Nom' }).fill('Gaëtan L.');
    await userEvent.keyboard('{Enter}');
    await expect.element(screen.getByText('Ajouté au Vivier')).toBeVisible();
    expect(added(background)[0]).toMatchObject({
      contact: { name: 'Gaëtan L.', status: 'pool', linkedinUrl: ASKED },
    });
  });

  test('Prospecting at the first Stage by default, or the one chosen; the line names it', async () => {
    const background = addable();
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));

    await choose(screen, 'État', 'En prospection');
    await expect.element(screen.getByRole('combobox', { name: 'Étape' })).toHaveValue('s-1');
    await screen.getByRole('combobox', { name: 'Étape' }).selectOptions('Relance');
    await screen.getByRole('button', { name: 'Ajouter' }).click();

    await expect.element(screen.getByText('Ajouté En prospection à Relance')).toBeVisible();
    expect(added(background)[0]).toMatchObject({
      contact: { status: 'prospecting', stageId: 's-2' },
    });
  });

  test('an Ally: the line says it joins the Circle', async () => {
    const { screen } = await renderSidebar(addable(), fakeTab(PROFILE));

    await choose(screen, 'État', 'Allié');
    await screen.getByRole('button', { name: 'Ajouter' }).click();

    await expect.element(screen.getByText('Ajouté au Cercle')).toBeVisible();
  });

  test('added: the card of the Contact, read again, and “Undo”, which brings the form back as sent', async () => {
    const background = addable();
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));
    await screen.getByRole('textbox', { name: 'Note' }).fill('Vu au salon');
    await screen.getByRole('button', { name: 'Ajouter' }).click();

    await expect.element(screen.getByRole('heading', { name: 'Gaëtan Lefèvre' })).toBeVisible();
    await expect.element(screen.getByRole('link', { name: 'Ouvrir sa fiche' })).toBeVisible();
    expect(lookups(background)).toHaveLength(2);
    await screen.getByRole('button', { name: 'Annuler' }).click();

    await expect.element(screen.getByRole('heading', { name: 'Ajouter un Contact' })).toBeVisible();
    await expect.element(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('Vu au salon');
    expect(background.messages).toContainEqual({ type: 'undo', tabId: TAB, undoToken: 'g-1' });
  });

  test('“Undo” too late: said so, the card stays', async () => {
    const background = addable();
    background.answer('undo', () => ({ status: 'refused', error: 'expired' }));
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));
    await screen.getByRole('button', { name: 'Ajouter' }).click();
    await screen.getByRole('button', { name: 'Annuler' }).click();

    await expect.element(screen.getByText('Ce geste ne peut plus être annulé.')).toBeVisible();
    await expect.element(screen.getByRole('link', { name: 'Ouvrir sa fiche' })).toBeVisible();
  });

  test('the line after an addition stays 10 s, and longer while the pointer is on it', async () => {
    const { screen } = await renderSidebar(addable(), fakeTab(PROFILE));
    await screen.getByRole('button', { name: 'Ajouter' }).click();
    const line = screen.getByText('Ajouté au Vivier');
    await expect.element(line).toBeVisible();

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await line.hover();
      await vi.advanceTimersByTimeAsync(ADDED_LINE_MS * 2);
      expect(line.query()).not.toBeNull();
      await commands.parkPointer();
      await vi.advanceTimersByTimeAsync(ADDED_LINE_MS - 100);
      expect(line.query()).not.toBeNull();
      await vi.advanceTimersByTimeAsync(200);
    } finally {
      vi.useRealTimers();
    }
    await expect.element(line).not.toBeInTheDocument();
    await expect.element(screen.getByRole('link', { name: 'Ouvrir sa fiche' })).toBeVisible();
  });

  test('the profile taken from another tab meanwhile: the card of its Contact, read again', async () => {
    const background = addable();
    background.answer('addContact', () => {
      background.answer('lookup', () => ({ status: 'contact', contact: prospecting }));
      return { status: 'taken' };
    });
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));
    await screen.getByRole('button', { name: 'Ajouter' }).click();

    await expect.element(screen.getByRole('link', { name: 'Ouvrir sa fiche' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Annuler' }).query()).toBeNull();
  });

  test('refused for the app changed meanwhile: said, the profile read again, the form kept', async () => {
    const background = addable();
    background.answer('addContact', () => ({ status: 'refused', error: 'organization_taken' }));
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));
    await screen.getByRole('textbox', { name: 'Poste' }).fill('Gérant fondateur');
    await screen.getByRole('button', { name: 'Ajouter' }).click();

    await expect.element(screen.getByText(/Cette Organisation existe déjà/)).toBeVisible();
    await expect
      .element(screen.getByRole('textbox', { name: 'Poste' }))
      .toHaveValue('Gérant fondateur');
    expect(lookups(background)).toHaveLength(2);

    background.answer('addContact', () => ({ status: 'refused', error: 'unknown_stage' }));
    await screen.getByRole('button', { name: 'Ajouter' }).click();
    await expect
      .element(screen.getByText("Cette Étape n'est plus dans le Funnel : choisis-en une autre."))
      .toBeVisible();
  });

  test('another profile or another tab: what was typed is lost, without asking', async () => {
    const { screen, tab } = await renderSidebar(addable(), fakeTab(PROFILE));
    const name = screen.getByRole('textbox', { name: 'Nom' });
    await name.fill('Gaëtan L.');

    tab.go(OTHER);
    await expect.element(name).toHaveValue('Gaëtan Lefèvre');
    await name.fill('Gaëtan L.');
    tab.go(PROFILE, TAB + 1);
    await expect.element(name).toHaveValue('Gaëtan Lefèvre');
  });
});

const UNREADABLE =
  "BattleCRM n'a pas pu lire ce profil : LinkedIn a peut-être changé sa présentation. Remplis les champs à la main.";

describe('“Read the page again” and a profile that cannot be read', () => {
  test('fills only the fields the User has not touched, “Coordonnées” opened since', async () => {
    const background = addable({ reading: { ...READING, email: null, phone: null } });
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));
    const jobTitle = screen.getByRole('textbox', { name: 'Poste' });
    await expect.element(jobTitle).toHaveValue('Gérant');
    await jobTitle.fill('Gérant fondateur');
    await screen.getByRole('textbox', { name: 'Note' }).fill('Vu au salon');
    background.answer('lookup', () =>
      toAdd({
        reading: { ...READING, jobTitle: 'CEO' },
        organizations: [VOLTEO],
        stages: STAGES,
      }),
    );

    await screen.getByRole('button', { name: 'Relire la page' }).click();

    await expect
      .element(screen.getByRole('textbox', { name: 'E-mail' }))
      .toHaveValue('gaetan.lefevre@exemple.fr');
    await expect
      .element(screen.getByRole('textbox', { name: 'Téléphone' }))
      .toHaveValue('0611223344');
    await expect.element(jobTitle).toHaveValue('Gérant fondateur');
    await expect.element(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('Vu au salon');
    // Waiting for the profile to show, as the content script does (10 s at most).
    expect(lookups(background).at(-1)).toEqual({
      type: 'lookup',
      url: ASKED,
      tabId: TAB,
      wait: true,
    });
    expect(screen.getByText(UNREADABLE).query()).toBeNull();
  });

  test('the name not read: read again at once, waiting for the profile; no alert once it shows', async () => {
    const background = addable();
    background.answer('lookup', ({ wait }) =>
      toAdd({ reading: wait ? READING : null, organizations: [VOLTEO], stages: STAGES }),
    );
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));

    await expect
      .element(screen.getByRole('textbox', { name: 'Nom' }))
      .toHaveValue('Gaëtan Lefèvre');
    expect(lookups(background)).toEqual([
      { type: 'lookup', url: ASKED, tabId: TAB },
      { type: 'lookup', url: ASKED, tabId: TAB, wait: true },
    ]);
    expect(screen.getByText(UNREADABLE).query()).toBeNull();
  });

  test('a profile that stays unreadable: the form all the same, the URL only, a discreet alert above', async () => {
    const background = addable({ reading: null });
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));

    await expect.element(screen.getByText(UNREADABLE)).toBeVisible();
    expect(lookups(background)).toHaveLength(2);
    await expect.element(screen.getByRole('textbox', { name: 'Nom' })).toHaveValue('');
    await expect.element(screen.getByRole('textbox', { name: 'Poste' })).toHaveValue('');
    await expect.element(screen.getByRole('textbox', { name: 'URL LinkedIn' })).toHaveValue(ASKED);
    expect(screen.getByText(/Même nom/).query()).toBeNull();
    // Never blocking: added by hand; “Read the page again” still there.
    await expect.element(screen.getByRole('button', { name: 'Relire la page' })).toBeEnabled();
    await screen.getByRole('textbox', { name: 'Nom' }).fill('Gaëtan L.');
    await userEvent.keyboard('{Enter}');
    await expect.element(screen.getByText('Ajouté au Vivier')).toBeVisible();
  });

  test('read again, the profile shows at last: the alert goes, the form is filled', async () => {
    const background = addable({ reading: null });
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));
    await expect.element(screen.getByText(UNREADABLE)).toBeVisible();
    background.answer('lookup', () =>
      toAdd({ reading: READING, organizations: [VOLTEO], stages: STAGES }),
    );

    await screen.getByRole('button', { name: 'Relire la page' }).click();

    await expect
      .element(screen.getByRole('textbox', { name: 'Nom' }))
      .toHaveValue('Gaëtan Lefèvre');
    expect(screen.getByText(UNREADABLE).query()).toBeNull();
  });

  test('a Contact found keeps its card, without any alert, nor a second read', async () => {
    const background = withCards({ [ASKED]: prospecting });
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));

    await expect.element(screen.getByRole('heading', { name: 'Gaëtan Lefèvre' })).toBeVisible();
    expect(screen.getByText(UNREADABLE).query()).toBeNull();
    expect(lookups(background)).toHaveLength(1);
  });
});

const SEARCH = 'https://www.linkedin.com/search/results/people/?keywords=ing%C3%A9nieur';
const UNREADABLE_SEARCH =
  "BattleCRM n'a repéré aucun résultat sur cette page : LinkedIn a peut-être changé sa présentation.";

describe('a search of people', () => {
  test('its results read: what to open, as elsewhere', async () => {
    const background = fakeBackground({ session: () => signedIn, readSearch: () => 'readable' });
    const { screen } = await renderSidebar(background, fakeTab(SEARCH));

    await expect.element(screen.getByText(ELSEWHERE)).toBeVisible();
    expect(background.messages).toContainEqual({ type: 'readSearch', url: SEARCH, tabId: TAB });
  });

  test('no result read: says LinkedIn may have changed its layout', async () => {
    const { screen } = await renderSidebar(
      fakeBackground({ session: () => signedIn, readSearch: () => 'unreadable' }),
      fakeTab(SEARCH),
    );

    await expect.element(screen.getByText(UNREADABLE_SEARCH)).toBeVisible();
    expect(screen.getByText(ELSEWHERE).query()).toBeNull();
  });

  test('a tab that cannot tell: what to open, as elsewhere', async () => {
    const { screen } = await renderSidebar(
      fakeBackground({ session: () => signedIn, readSearch: () => 'unknown' }),
      fakeTab(SEARCH),
    );

    await expect.element(screen.getByText(ELSEWHERE)).toBeVisible();
  });

  test('the next page of the search: read again', async () => {
    const background = fakeBackground({ session: () => signedIn, readSearch: () => 'readable' });
    const { screen, tab } = await renderSidebar(background, fakeTab(SEARCH));
    await expect.element(screen.getByText(ELSEWHERE)).toBeVisible();

    background.answer('readSearch', () => 'unreadable');
    tab.go(`${SEARCH}&page=2`);

    await expect.element(screen.getByText(UNREADABLE_SEARCH)).toBeVisible();
    expect(background.messages.filter(({ type }) => type === 'readSearch')).toHaveLength(2);
  });
});

describe('Contacts of the same name', () => {
  const SAME_NAME = [
    { id: 'c-7', name: 'Gaëtan Lefèvre', organizationName: 'Capgemini' },
    { id: 'c-8', name: 'Gaetan Lefevre', organizationName: null },
  ];

  test('one discreet line each, with its record; adding is never blocked', async () => {
    const background = addable({ sameName: SAME_NAME });
    const { screen } = await renderSidebar(background, fakeTab(PROFILE));

    await expect.element(screen.getByText('Même nom : Gaëtan Lefèvre · Capgemini')).toBeVisible();
    expect(
      screen
        .getByRole('listitem')
        .elements()
        .map((line) => line.textContent),
    ).toEqual([
      'Même nom : Gaëtan Lefèvre · Capgemini Ouvrir sa fiche',
      'Même nom : Gaetan Lefevre Ouvrir sa fiche',
    ]);
    const records = screen.getByRole('link', { name: 'Ouvrir sa fiche' });
    expect(records.elements().map((link) => link.getAttribute('href'))).toEqual([
      `${APP_ORIGIN}/contacts/c-7`,
      `${APP_ORIGIN}/contacts/c-8`,
    ]);
    expect(records.elements().map((link) => link.getAttribute('target'))).toEqual([
      '_blank',
      '_blank',
    ]);

    await screen.getByRole('button', { name: 'Ajouter' }).click();
    await expect.element(screen.getByText('Ajouté au Vivier')).toBeVisible();
  });
});

describe('theme', () => {
  test('follows the system', async () => {
    await renderSidebar();
    await expect.poll(() => document.documentElement.classList.contains('dark')).toBe(false);

    await commands.emulateColorScheme('dark');

    await expect.poll(() => document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('accessibility', () => {
  /** Each screen of the sidebar, reached as the User reaches it: what shows it is there. */
  const screens = {
    'sign-in': async () => {
      const { screen } = await renderSidebar();
      return screen.getByRole('heading', { name: 'Connexion' });
    },
    'sign-in refused': async () => {
      const { screen } = await renderSidebar(
        fakeBackground({ signIn: () => ({ status: 'refused', error: 'invalid_credentials' }) }),
      );
      await fillSignIn(screen);
      return screen.getByText(/mot de passe incorrect/);
    },
    code: async () => {
      const { screen } = await renderSidebar(
        fakeBackground({
          signIn: () => ({ status: 'codeRequired' }),
          verifyCode: () => ({ status: 'refused', error: 'invalid_code' }),
        }),
      );
      await fillSignIn(screen);
      await giveCode(screen);
      return screen.getByText('Code incorrect.');
    },
    expired: async () => {
      const { screen } = await renderSidebar(
        fakeBackground({ session: () => ({ status: 'expired', email: 'jane@example.com' }) }),
      );
      return screen.getByText('Ta session a expiré');
    },
    outdated: async () => {
      const { screen } = await renderSidebar(
        fakeBackground({ session: () => ({ status: 'outdated' }) }),
      );
      return screen.getByRole('link');
    },
    unreachable: async () => {
      const { screen } = await renderSidebar(
        fakeBackground({ session: () => ({ status: 'unreachable' }) }),
      );
      return screen.getByRole('button', { name: 'Réessayer' });
    },
    'card of a Contact Prospecting': async () => {
      const { screen } = await renderSidebar(withCards({ [ASKED]: prospecting }), fakeTab(PROFILE));
      return screen.getByRole('link', { name: 'Ouvrir sa fiche' });
    },
    'card of a Contact Archived': async () => {
      const { screen } = await renderSidebar(
        withCards({ [ASKED]: { ...ally, status: 'archived' } }),
        fakeTab(PROFILE),
      );
      return screen.getByText('Archivé', { exact: true });
    },
    'card of an Ally': async () => {
      const { screen } = await renderSidebar(withCards({ [ASKED]: ally }), fakeTab(PROFILE));
      return screen.getByText('Aucun échange');
    },
    'form to add a Contact': async () => {
      const { screen } = await renderSidebar(addable({ organizations: [] }), fakeTab(PROFILE));
      await choose(screen, 'État', 'En prospection');
      await screen.getByRole('button', { name: 'Ajouter' }).click();
      return screen.getByText('Choisis le type de cette nouvelle Organisation.');
    },
    'form with Contacts of the same name': async () => {
      const { screen } = await renderSidebar(
        addable({
          sameName: [{ id: 'c-7', name: 'Gaëtan Lefèvre', organizationName: 'Capgemini' }],
        }),
        fakeTab(PROFILE),
      );
      return screen.getByText('Même nom : Gaëtan Lefèvre · Capgemini');
    },
    'form of an unreadable profile': async () => {
      const { screen } = await renderSidebar(addable({ reading: null }), fakeTab(PROFILE));
      return screen.getByText(UNREADABLE);
    },
    'card after an addition': async () => {
      const { screen } = await renderSidebar(addable(), fakeTab(PROFILE));
      await screen.getByRole('button', { name: 'Ajouter' }).click();
      return screen.getByText('Ajouté au Vivier');
    },
    'unreadable search': async () => {
      const { screen } = await renderSidebar(
        fakeBackground({ session: () => signedIn, readSearch: () => 'unreadable' }),
        fakeTab(SEARCH),
      );
      return screen.getByText(UNREADABLE_SEARCH);
    },
    elsewhere: async () => {
      const { screen } = await renderSidebar(fakeBackground({ session: () => signedIn }));
      return screen.getByText(ELSEWHERE);
    },
  };

  for (const scheme of ['light', 'dark'] as const) {
    for (const [name, reach] of Object.entries(screens)) {
      test(`${name}, ${scheme} theme`, async () => {
        await commands.emulateColorScheme(scheme);
        await expect.element(await reach()).toBeVisible();
        await expectNoAxeViolations();
      });
    }
  }
});
