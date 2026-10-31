import { beforeEach, describe, expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { APP_ORIGIN, fakeBackground, renderSidebar } from '../../test/render-sidebar.tsx';

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
