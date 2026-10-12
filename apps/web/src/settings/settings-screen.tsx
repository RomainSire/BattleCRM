import { m } from '@battlecrm/i18n';
import { useId } from 'react';

import { Screen } from '../screens/screen.tsx';
import { ChangePassword } from './change-password.tsx';
import { ConnectedDevices } from './connected-devices.tsx';

/** Settings (spec UX §5.8). Only the Account section so far: the others join with their tickets (20, 35). */
export function SettingsScreen() {
  const accountId = useId();
  return (
    <Screen title={m.settings()}>
      <section aria-labelledby={accountId} className="flex max-w-xl flex-col gap-6">
        <h2 id={accountId} className="text-base font-semibold">
          {m.settings_account()}
        </h2>
        <ChangePassword />
        <ConnectedDevices />
      </section>
    </Screen>
  );
}
