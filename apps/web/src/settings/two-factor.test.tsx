import { beforeEach, describe, expect, test, vi } from 'vitest';
import { commands, page } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';

const PASSWORD = 'correct horse battery staple';
const STATUS = 'GET /api/account/two-factor';
const START = 'POST /api/account/two-factor';
const CONFIRM = 'POST /api/account/two-factor/confirm';
const NEW_CODES = 'POST /api/account/two-factor/backup-codes';
const DISABLE = 'POST /api/account/two-factor/disable';
const SESSIONS = 'GET /api/sessions';

const KEY = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const TOTP_URI = `otpauth://totp/BattleCRM:jane%40example.com?secret=${KEY}&issuer=BattleCRM`;
const BACKUP_CODES = [
  'aB3de-Fg7hi',
  'Jk1mn-Op2qr',
  'St3uv-Wx4yz',
  'Ab5cd-Ef6gh',
  'Ij7kl-Mn8op',
  'Qr9st-Uv0wx',
  'Yz1ab-Cd2ef',
  'Gh3ij-Kl4mn',
  'Op5qr-St6uv',
  'Wx7yz-Ab8cd',
];

const withSessions = { [SESSIONS]: () => Response.json({ sessions: [] }) };
const on = (backupCodesLeft = 10) => ({
  ...withSessions,
  [STATUS]: () => Response.json({ enabled: true, backupCodesLeft }),
});
/** The API of an account that turns its second factor on: off until the first code confirms the key. */
function turningOn() {
  let enabled = false;
  return {
    ...withSessions,
    [STATUS]: () =>
      Response.json(enabled ? { enabled: true, backupCodesLeft: 10 } : { enabled: false }),
    [START]: () => Response.json({ totpUri: TOTP_URI }),
    [CONFIRM]: () => {
      enabled = true;
      return Response.json({ backupCodes: BACKUP_CODES });
    },
  };
}
const refusedWith = (route: string, error: string, status: number) => ({
  [route]: () => Response.json({ error }, { status }),
});

type Screen = Awaited<ReturnType<typeof renderApp>>['screen'];

const form = (screen: Screen) => screen.getByRole('form', { name: 'Double authentification' });
const password = (screen: Screen) =>
  form(screen).getByLabelText('Mot de passe actuel', { exact: true });
const confirmation = (screen: Screen) =>
  screen.getByRole('textbox', { name: 'Code de confirmation' });
const qrCode = (screen: Screen) => screen.getByRole('figure', { name: 'QR code de la clé' });
const codesPanel = (screen: Screen) => screen.getByRole('region', { name: 'Codes de secours' });

async function askForKey(screen: Screen, given = PASSWORD) {
  await password(screen).fill(given);
  await screen.getByRole('button', { name: 'Activer', exact: true }).click();
}

async function confirm(screen: Screen, code = '123456') {
  await confirmation(screen).fill(code);
  await screen.getByRole('button', { name: 'Confirmer' }).click();
}

/** Ticks “My codes are safe”, by its text as a User does: the box itself is drawn over the input. */
async function sayTheyAreSafe(screen: Screen) {
  await codesPanel(screen).getByText("J'ai mis mes codes en lieu sûr").click();
  await expect
    .element(codesPanel(screen).getByRole('checkbox', { name: "J'ai mis mes codes en lieu sûr" }))
    .toBeChecked();
}

/** What the page handed to the clipboard. */
function clipboard() {
  return vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
}

/** A button that came under the pointer, or left it, has finished changing colour. */
async function settled() {
  await expect.poll(() => document.getAnimations().length).toBe(0);
}

beforeEach(() => {
  vi.restoreAllMocks();
  return page.viewport(1280, 800);
});

describe('turning the second factor on, in the Account section of Settings', () => {
  test('off, it says what it is for and asks for the password', async () => {
    const { screen } = await renderApp('/settings', fakeApi(withSessions));

    await expect
      .element(screen.getByRole('heading', { level: 3, name: 'Double authentification' }))
      .toBeVisible();
    await expect
      .element(
        screen.getByText(
          "Un code de ton application d'authentification te sera demandé à chaque connexion, en plus du mot de passe.",
        ),
      )
      .toBeVisible();
    await expect.element(password(screen)).toHaveAttribute('autocomplete', 'current-password');
  });

  test('the password gives the key: a QR code, and a text to copy', async () => {
    const copied = clipboard();
    const { screen, api } = await renderApp('/settings', fakeApi(turningOn()));

    await askForKey(screen);

    await expect.element(qrCode(screen)).toBeVisible();
    expect(api.sent(START)).toEqual([{ route: START, body: { password: PASSWORD } }]);
    await expect.element(screen.getByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeVisible();

    await screen.getByRole('button', { name: 'Copier la clé' }).click();

    await expect.element(screen.getByText('Copié.')).toBeVisible();
    expect(copied).toHaveBeenCalledExactlyOnceWith(KEY);
  });

  test('says when the browser refused to copy', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    const { screen } = await renderApp('/settings', fakeApi(turningOn()));
    await askForKey(screen);

    await screen.getByRole('button', { name: 'Copier la clé' }).click();

    await expect
      .element(screen.getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné.");
    await expect.element(screen.getByText('Copié.')).not.toBeInTheDocument();
  });

  test('the QR code stays dark on white in the dark theme', async () => {
    await commands.emulateColorScheme('dark');
    const { screen } = await renderApp('/settings', fakeApi(turningOn()));
    await askForKey(screen);

    await expect.element(qrCode(screen)).toBeVisible();

    expect(getComputedStyle(qrCode(screen).element()).backgroundColor).toBe('rgb(255, 255, 255)');
  });

  test('a first code turns it on and shows the 10 backup codes', async () => {
    const { screen, api } = await renderApp('/settings', fakeApi(turningOn()));
    await askForKey(screen);

    await expect.element(confirmation(screen)).toHaveAttribute('inputmode', 'numeric');
    await confirm(screen);

    await expect.element(codesPanel(screen)).toBeVisible();
    // The password that asked for the key goes with the code: it is the request that turns it on.
    expect(api.sent(CONFIRM)).toEqual([
      { route: CONFIRM, body: { password: PASSWORD, code: '123456' } },
    ]);
    const codes = codesPanel(screen).getByRole('listitem').elements();
    expect(codes.map((code) => code.textContent)).toEqual(BACKUP_CODES);
    await expect.element(qrCode(screen)).not.toBeInTheDocument();
  });

  test('the codes are copied or downloaded, and the panel closes once they are said to be safe', async () => {
    const copied = clipboard();
    const { screen } = await renderApp('/settings', fakeApi(turningOn()));
    await askForKey(screen);
    await confirm(screen);
    const panel = codesPanel(screen);
    const done = panel.getByRole('button', { name: 'Terminé' });
    const text = `${BACKUP_CODES.join('\n')}\n`;

    await expect.element(done).toBeDisabled();
    await panel.getByRole('button', { name: 'Copier' }).click();
    expect(copied).toHaveBeenCalledExactlyOnceWith(text);
    const download = panel.getByRole('link', { name: 'Télécharger' });
    await expect.element(download).toHaveAttribute('download', 'battlecrm-backup-codes.txt');
    const href = download.element().getAttribute('href') ?? '';
    expect(decodeURIComponent(href.replace('data:text/plain;charset=utf-8,', ''))).toBe(text);

    await sayTheyAreSafe(screen);
    await done.click();

    await expect.element(codesPanel(screen)).not.toBeInTheDocument();
    await expect
      .element(screen.getByText('Activée. Codes de secours restants : 10.'))
      .toBeVisible();
    await expect.element(screen.getByText(BACKUP_CODES[0] ?? '')).not.toBeInTheDocument();
  });

  test('a wrong password is said on its field', async () => {
    const { screen } = await renderApp(
      '/settings',
      fakeApi({ ...withSessions, ...refusedWith(START, 'wrong_password', 403) }),
    );

    await askForKey(screen, 'not the right password');

    await expect.element(password(screen)).toBeInvalid();
    await expect.element(form(screen).getByText('Mot de passe incorrect.')).toBeVisible();
  });

  test('a wrong code is said on its field, and the key stays', async () => {
    const { screen } = await renderApp(
      '/settings',
      fakeApi({ ...turningOn(), ...refusedWith(CONFIRM, 'invalid_code', 400) }),
    );
    await askForKey(screen);

    await confirm(screen);

    await expect.element(confirmation(screen)).toBeInvalid();
    await expect.element(screen.getByText('Code incorrect.')).toBeVisible();
    await expect.element(qrCode(screen)).toBeVisible();
  });

  test('“Cancel” leaves it off', async () => {
    const { screen, api } = await renderApp('/settings', fakeApi(turningOn()));
    await askForKey(screen);

    await screen.getByRole('button', { name: 'Annuler' }).click();

    await expect
      .element(screen.getByRole('button', { name: 'Activer', exact: true }))
      .toBeVisible();
    await expect.element(qrCode(screen)).not.toBeInTheDocument();
    expect(api.sent(CONFIRM)).toEqual([]);
  });

  test('too many attempts are said, and so is a failure of the API', async () => {
    const blocked = await renderApp(
      '/settings',
      fakeApi({ ...withSessions, ...refusedWith(START, 'too_many_attempts', 429) }),
    );
    await askForKey(blocked.screen);
    await expect
      .element(form(blocked.screen).getByRole('alert'))
      .toHaveTextContent('Trop de tentatives. Réessaie dans 15 minutes.');
    await blocked.screen.unmount();

    const broken = await renderApp(
      '/settings',
      fakeApi({ ...turningOn(), [CONFIRM]: () => new Response(null, { status: 500 }) }),
    );
    await askForKey(broken.screen);
    await confirm(broken.screen);
    await expect
      .element(form(broken.screen).getByRole('alert'))
      .toHaveTextContent("Quelque chose n'a pas fonctionné.");
  });
});

describe('a second factor that is on', () => {
  test('says how many backup codes are left', async () => {
    const { screen } = await renderApp('/settings', fakeApi(on(4)));

    await expect.element(screen.getByText('Activée. Codes de secours restants : 4.')).toBeVisible();
    await expect
      .element(screen.getByText("Il t'en reste peu : régénère-les."))
      .not.toBeInTheDocument();
  });

  test('says to make new ones when 3 or fewer are left', async () => {
    const { screen } = await renderApp('/settings', fakeApi(on(3)));

    await expect.element(screen.getByText('Codes de secours restants : 3.')).toBeVisible();
    await expect.element(screen.getByText("Il t'en reste peu : régénère-les.")).toBeVisible();
  });

  test('the password makes new backup codes, shown once', async () => {
    let left = 2;
    const { screen, api } = await renderApp(
      '/settings',
      fakeApi({
        ...withSessions,
        [STATUS]: () => Response.json({ enabled: true, backupCodesLeft: left }),
        [NEW_CODES]: () => {
          left = 10;
          return Response.json({ backupCodes: BACKUP_CODES });
        },
      }),
    );

    await password(screen).fill(PASSWORD);
    await screen.getByRole('button', { name: 'Régénérer les codes de secours' }).click();

    await expect.element(codesPanel(screen).getByRole('listitem').first()).toBeVisible();
    expect(api.sent(NEW_CODES)).toEqual([{ route: NEW_CODES, body: { password: PASSWORD } }]);
    expect(api.sent(DISABLE)).toEqual([]);
    await sayTheyAreSafe(screen);
    await codesPanel(screen).getByRole('button', { name: 'Terminé' }).click();
    await expect.element(screen.getByText('Codes de secours restants : 10.')).toBeVisible();
  });

  test('the password turns it off', async () => {
    let enabled = true;
    const { screen, api } = await renderApp(
      '/settings',
      fakeApi({
        ...withSessions,
        [STATUS]: () =>
          Response.json(enabled ? { enabled: true, backupCodesLeft: 10 } : { enabled: false }),
        [DISABLE]: () => {
          enabled = false;
          return new Response(null, { status: 204 });
        },
      }),
    );

    await password(screen).fill(PASSWORD);
    await screen.getByRole('button', { name: 'Désactiver' }).click();

    await expect
      .element(screen.getByRole('button', { name: 'Activer', exact: true }))
      .toBeVisible();
    expect(api.sent(DISABLE)).toEqual([{ route: DISABLE, body: { password: PASSWORD } }]);
    expect(api.sent(NEW_CODES)).toEqual([]);
  });

  test('neither is done without the password', async () => {
    const { screen, api } = await renderApp('/settings', fakeApi(on()));
    await expect.element(password(screen)).toBeVisible();

    await screen.getByRole('button', { name: 'Désactiver' }).click();

    await expect.element(password(screen)).toBeInvalid();
    expect(api.sent(DISABLE)).toEqual([]);
    expect(api.sent(NEW_CODES)).toEqual([]);
  });

  test('a wrong password is said on its field, and nothing changes', async () => {
    const { screen } = await renderApp(
      '/settings',
      fakeApi({ ...on(), ...refusedWith(DISABLE, 'wrong_password', 403) }),
    );

    await password(screen).fill('not the right password');
    await screen.getByRole('button', { name: 'Désactiver' }).click();

    await expect.element(password(screen)).toBeInvalid();
    await expect.element(form(screen).getByText('Mot de passe incorrect.')).toBeVisible();
    await expect.element(screen.getByText('Activée.', { exact: false })).toBeVisible();
  });

  test('on a phone, every button is at least 44 px high', async () => {
    await page.viewport(390, 800);
    const { screen } = await renderApp('/settings', fakeApi(on()));
    await expect.element(password(screen)).toBeVisible();

    const buttons = form(screen).getByRole('button').elements();
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
  });
});

describe.each(['light', 'dark'] as const)('axe finds nothing in the %s theme', (scheme) => {
  // Before the first render: a colour measured during a transition would prove nothing.
  beforeEach(() => commands.emulateColorScheme(scheme));

  test.each([
    ['desktop', 1280],
    ['mobile', 390],
  ] as const)('from off to on, a wrong code on the way, %s', async (_width, width) => {
    await page.viewport(width, 800);
    let attempts = 0;
    const api = turningOn();
    const { screen } = await renderApp(
      '/settings',
      fakeApi({
        ...api,
        [CONFIRM]: () => {
          attempts += 1;
          return attempts === 1
            ? Response.json({ error: 'invalid_code' }, { status: 400 })
            : api[CONFIRM]();
        },
      }),
    );
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');
    await expect.element(password(screen)).toBeVisible();
    await settled();
    await expectNoAxeViolations();

    await askForKey(screen);
    await confirm(screen);
    await expect.element(screen.getByText('Code incorrect.')).toBeVisible();
    await settled();
    await expectNoAxeViolations();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);

    await confirm(screen, '654321');
    await expect.element(codesPanel(screen)).toBeVisible();
    await settled();
    await expectNoAxeViolations();

    await sayTheyAreSafe(screen);
    await codesPanel(screen).getByRole('button', { name: 'Terminé' }).click();
    await expect.element(screen.getByText('Activée.', { exact: false })).toBeVisible();
    await settled();
    await expectNoAxeViolations();
  });
});
