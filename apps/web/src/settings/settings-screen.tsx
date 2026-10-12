import { m } from '@battlecrm/i18n';
import { useId } from 'react';

import { Screen } from '../screens/screen.tsx';
import { ChangeEmail } from './change-email.tsx';
import { ChangePassword } from './change-password.tsx';
import { ConnectedDevices } from './connected-devices.tsx';
import { TwoFactor } from './two-factor.tsx';

const cardClass = 'rounded-card border p-4';

/** Settings (spec UX §5.8). Only the Account section so far: the others join with their tickets (20, 35). */
export function SettingsScreen() {
  const accountId = useId();
  return (
    <Screen title={m.settings()}>
      <section aria-labelledby={accountId} className="flex max-w-xl flex-col gap-4">
        <h2 id={accountId} className="text-base font-semibold">
          {m.settings_account()}
        </h2>
        {/* One card per subject: a thin rule, no shadow (spec UX §2). */}
        <div className={cardClass}>
          <ChangeEmail />
        </div>
        <div className={cardClass}>
          <ChangePassword />
        </div>
        <div className={cardClass}>
          <TwoFactor />
        </div>
        <div className={cardClass}>
          <ConnectedDevices />
        </div>
      </section>
    </Screen>
  );
}
