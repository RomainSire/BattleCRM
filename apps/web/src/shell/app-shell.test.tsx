import { setLocale } from '@battlecrm/i18n/runtime';
import { expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { summary } from '../../test/summary.ts';
import { applyDocumentLanguage } from '../i18n.ts';

const desktop = () => page.viewport(1280, 800);
const mobile = () => page.viewport(390, 800);

const accessibleNames = (elements: Element[]) =>
  elements.map((element) => element.textContent?.replace(/\s+/g, ' ').trim());

test('opens on Today with the desktop sidebar', async () => {
  await desktop();
  const { screen } = await renderApp('/');

  await expect
    .element(screen.getByRole('heading', { level: 1, name: "Aujourd'hui" }))
    .toBeVisible();
  const menu = screen.getByRole('navigation', { name: 'Menu principal' });
  await expect.element(menu).toBeVisible();
  expect(accessibleNames(menu.getByRole('link').elements())).toEqual([
    "Aujourd'hui",
    'Cercle',
    'Contacts',
    'Funnel',
    'Battles',
    'Positionnements',
    'Indicateurs',
    'Réglages',
  ]);
  await expect.element(menu.getByRole('list', { name: 'Prospection' })).toBeVisible();
  await expect.element(menu.getByRole('list', { name: 'Expérimentation' })).toBeVisible();
  await expect.element(menu.getByRole('button', { name: /Rechercher…/ })).toBeVisible();
  await expect.element(menu.getByRole('button', { name: /Ajouter/ })).toBeVisible();
  await expect.element(menu.getByRole('button', { name: /Raccourcis/ })).toBeVisible();
  await expect
    .element(menu.getByRole('link', { name: "Aujourd'hui" }))
    .toHaveAttribute('aria-current', 'page');
});

test('each sidebar entry leads to its empty screen', async () => {
  await desktop();
  const { screen, router } = await renderApp('/today');
  const menu = screen.getByRole('navigation', { name: 'Menu principal' });

  const entries = [
    ['Cercle', '/circle'],
    ['Contacts', '/contacts'],
    ['Funnel', '/funnel'],
    ['Battles', '/battles'],
    ['Positionnements', '/positionings'],
    ['Indicateurs', '/insights'],
    ['Réglages', '/settings'],
    ["Aujourd'hui", '/today'],
  ] as const;
  for (const [name, path] of entries) {
    await menu.getByRole('link', { name }).click();
    await expect.element(screen.getByRole('heading', { level: 1, name })).toBeVisible();
    expect(router.state.location.pathname).toBe(path);
    await expect.element(menu.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
  }
});

test('narrow widths get the bottom tabs and More instead of the sidebar', async () => {
  await mobile();
  const { screen } = await renderApp('/');

  await expect
    .element(screen.getByRole('heading', { level: 1, name: "Aujourd'hui" }))
    .toBeVisible();
  const tabs = screen.getByRole('navigation', { name: 'Menu principal' });
  expect(accessibleNames(tabs.getByRole('link').elements())).toEqual([
    "Aujourd'hui",
    'Contacts',
    'Funnel',
    'Plus',
  ]);
  await expect.element(screen.getByRole('button', { name: 'Rechercher…' })).toBeVisible();

  await tabs.getByRole('link', { name: 'Plus' }).click();
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Plus' })).toBeVisible();
  const more = screen.getByRole('main');
  expect(accessibleNames(more.getByRole('link').elements())).toEqual([
    'Cercle',
    'Battles',
    'Indicateurs',
    'Réglages',
    'Positionnements',
  ]);
  await expect.element(more.getByRole('list', { name: 'Sur ordinateur' })).toBeVisible();

  await more.getByRole('link', { name: 'Cercle' }).click();
  await expect.element(screen.getByRole('heading', { level: 1, name: 'Cercle' })).toBeVisible();
  // A screen reached through More keeps the More tab current.
  await expect
    .element(tabs.getByRole('link', { name: 'Plus' }))
    .toHaveAttribute('aria-current', 'page');
});

test('the layout switches on width alone', async () => {
  await desktop();
  const { screen } = await renderApp('/');
  const sidebarSearch = screen.getByRole('button', { name: /Rechercher…/ });
  await expect.element(screen.getByRole('link', { name: 'Indicateurs' })).toBeVisible();

  await mobile();
  await expect.element(screen.getByRole('link', { name: 'Plus' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Indicateurs' })).not.toBeInTheDocument();
  await expect.element(sidebarSearch).toBeVisible();

  await desktop();
  await expect.element(screen.getByRole('link', { name: 'Plus' })).not.toBeInTheDocument();
});

test('targets are at least 24 px on desktop and 44 px on mobile', async () => {
  await desktop();
  const { screen } = await renderApp('/');
  const menu = screen.getByRole('navigation');
  for (const target of [
    ...menu.getByRole('link').elements(),
    ...menu.getByRole('button').elements(),
  ]) {
    expect(target.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
  }

  await mobile();
  for (const target of screen.getByRole('navigation').getByRole('link').elements()) {
    expect(target.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  }
  expect(
    screen.getByRole('button', { name: 'Rechercher…' }).element().getBoundingClientRect().height,
  ).toBeGreaterThanOrEqual(44);
});

test('the first Tab reaches “Skip to content”, which moves focus to the content', async () => {
  await desktop();
  const { screen } = await renderApp('/');
  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();

  await userEvent.keyboard('{Tab}');
  const skipLink = screen.getByRole('link', { name: 'Aller au contenu' });
  await expect.element(skipLink).toHaveFocus();
  await expect.element(skipLink).toBeVisible();

  await userEvent.keyboard('{Enter}');
  await expect.element(screen.getByRole('main')).toHaveFocus();
});

test('has the landmarks of spec UX §7', async () => {
  await desktop();
  const { screen } = await renderApp('/');
  await expect.element(screen.getByRole('navigation', { name: 'Menu principal' })).toBeVisible();
  await expect.element(screen.getByRole('main')).toBeVisible();
});

test('speaks English when the locale is English, and says so to the page', async () => {
  await desktop();
  await setLocale('en', { reload: false });
  applyDocumentLanguage();
  const { screen } = await renderApp(
    '/',
    fakeApi({
      'GET /api/summary': () => Response.json(summary({ settings: { locale: 'en' } })),
    }),
  );

  await expect.element(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Insights' })).toBeVisible();
  expect(document.documentElement.lang).toBe('en');

  await setLocale('fr', { reload: false });
  applyDocumentLanguage();
  expect(document.documentElement.lang).toBe('fr');
});

test.each([
  ['light', 'desktop'],
  ['dark', 'desktop'],
  ['light', 'mobile'],
  ['dark', 'mobile'],
] as const)('axe finds nothing in the %s theme, %s', async (scheme, width) => {
  await (width === 'desktop' ? desktop() : mobile());
  await commands.emulateColorScheme(scheme);
  const { screen } = await renderApp('/');
  await expect.element(screen.getByRole('heading', { level: 1 })).toBeVisible();
  await expect
    .poll(() => document.documentElement.classList.contains('dark'))
    .toBe(scheme === 'dark');

  await expectNoAxeViolations();
});
