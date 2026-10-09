import { afterEach, expect, test, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { ThemeProvider, useTheme } from './theme-provider.tsx';

function ThemeSwitch() {
  const { preference, setPreference } = useTheme();
  return (
    <div>
      <p>preference: {preference}</p>
      <button onClick={() => setPreference('dark')}>dark</button>
      <button onClick={() => setPreference('light')}>light</button>
      <button onClick={() => setPreference('system')}>system</button>
    </div>
  );
}

const isDark = () => document.documentElement.classList.contains('dark');

afterEach(() => {
  vi.restoreAllMocks();
});

test('follows the system by default, live', async () => {
  const screen = await render(
    <ThemeProvider>
      <ThemeSwitch />
    </ThemeProvider>,
  );
  await expect.element(screen.getByText('preference: system')).toBeVisible();
  expect(isDark()).toBe(false);

  await commands.emulateColorScheme('dark');
  await expect.poll(isDark).toBe(true);

  await commands.emulateColorScheme('light');
  await expect.poll(isDark).toBe(false);
});

test('a chosen theme wins over the system and is kept on the device', async () => {
  await commands.emulateColorScheme('dark');
  const screen = await render(
    <ThemeProvider>
      <ThemeSwitch />
    </ThemeProvider>,
  );
  await screen.getByRole('button', { name: 'light' }).click();
  await expect.poll(isDark).toBe(false);
  await screen.unmount();

  const again = await render(
    <ThemeProvider>
      <ThemeSwitch />
    </ThemeProvider>,
  );
  await expect.element(again.getByText('preference: light')).toBeVisible();
  expect(isDark()).toBe(false);

  await again.getByRole('button', { name: 'system' }).click();
  await expect.poll(isDark).toBe(true);
});

test('opens on the system theme when storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError');
  });
  await commands.emulateColorScheme('dark');

  const screen = await render(
    <ThemeProvider>
      <ThemeSwitch />
    </ThemeProvider>,
  );
  await expect.element(screen.getByText('preference: system')).toBeVisible();
  expect(isDark()).toBe(true);

  await screen.getByRole('button', { name: 'light' }).click();
  await expect.poll(isDark).toBe(false);
});

test('ignores a stored value it does not know', async () => {
  localStorage.setItem('battlecrm.theme', 'sepia');
  const screen = await render(
    <ThemeProvider>
      <ThemeSwitch />
    </ThemeProvider>,
  );
  await expect.element(screen.getByText('preference: system')).toBeVisible();
});
