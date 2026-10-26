import { test as anonymous, type Page } from '@playwright/test';

import { expect, expectNoAxeViolations, seed, test } from './support/fixtures.ts';

const THEMES = ['light', 'dark'] as const;
const PHONE = { width: 390, height: 844 };

/** Opens `path` and waits for its heading: the screen is drawn, in the colours of `theme`. */
async function open(
  page: Page,
  path: string,
  heading: string | RegExp,
  theme: (typeof THEMES)[number],
) {
  await page.goto(path);
  // Firefox under Playwright drops the emulated scheme as it navigates; the app follows it live.
  await page.emulateMedia({ colorScheme: theme });
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/);
}

/** Something on every screen: a Battle under way, a Contact in each Status, an overdue Follow-up. */
async function seedEveryScreen(page: Page) {
  const outreach = await seed.stageId(page.request, 'Approche');
  const mailA = await seed.positioning(page.request, outreach, 'Mail A');
  const mailB = await seed.positioning(page.request, outreach, 'Mail B');
  const claire = await seed.contact(page.request, {
    name: 'Claire Martin',
    status: 'prospecting',
    stageId: outreach,
    newOrganization: { name: 'Capgemini', type: 'consultancy' },
  });
  await seed.sent(page.request, claire, mailA, 10);
  // Sent before the Battle opens: under it, the Assignment would come first.
  await seed.battle(page.request, { stageId: outreach, championId: mailA, challengerId: mailB });
  await seed.contact(page.request, { name: 'Hugo Blanc' });
  await seed.contact(page.request, { name: 'Paul Simon', status: 'ally' });
  await seed.contact(page.request, { name: 'Léa Petit', status: 'prospecting', stageId: outreach });

  return { claire, organization: await seed.organizationId(page.request, 'Capgemini') };
}

// The theme follows the system's by default.
for (const theme of THEMES) {
  test.describe(`in the ${theme} theme`, () => {
    test.use({ colorScheme: theme });

    test('axe finds nothing on any screen of the app', async ({ page }) => {
      // Every screen twice, on a desktop and on a phone.
      test.setTimeout(120_000);
      const { claire, organization } = await seedEveryScreen(page);
      const screens: [string, string | RegExp][] = [
        ['/today', "Aujourd'hui"],
        ['/circle', 'Cercle'],
        ['/contacts', 'Contacts'],
        [`/contacts/${claire}`, 'Claire Martin'],
        [`/organizations/${organization}`, 'Capgemini'],
        ['/funnel', 'Funnel'],
        ['/battles', 'Battles'],
        ['/positionings', 'Positionnements'],
        ['/insights', 'Indicateurs'],
        ['/settings', 'Réglages'],
        // The link of an address change, opened once used: it says so.
        ['/change-email', /lien/i],
      ];
      for (const [path, heading] of screens) {
        await open(page, path, heading, theme);
        await expectNoAxeViolations(page, path);
      }

      // The phone's own layouts: the tabs, one thing at a time, the record as a page, and More.
      await page.setViewportSize(PHONE);
      for (const [path, heading] of [...screens, ['/more', 'Plus'] as const]) {
        await open(page, path, heading, theme);
        await expectNoAxeViolations(page, `${path} on a phone`);
      }
    });
  });

  anonymous.describe(`in the ${theme} theme`, () => {
    anonymous.use({ colorScheme: theme });

    anonymous('axe finds nothing on the screens without a session', async ({ page }) => {
      for (const [path, heading] of [
        ['/sign-in', 'Connexion'],
        ['/sign-up', 'Créer un compte'],
        ['/forgot-password', /mot de passe/i],
        ['/reset-password', /lien/i],
        ['/verify-email', /lien/i],
        ['/cancel-two-factor-recovery', /lien/i],
      ] as const) {
        await open(page, path, heading, theme);
        await expectNoAxeViolations(page, path);
      }
    });
  });
}
