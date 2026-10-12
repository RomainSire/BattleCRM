import { m } from '@battlecrm/i18n';
import { Link } from 'react-aria-components';

import { authLinkClass } from '../auth/auth-layout.tsx';
import { useLocale } from '../i18n.ts';
import { Screen } from '../screens/screen.tsx';

/** Shown while the link is being checked; a valid one leads straight to Settings, the new address in place. */
export function ChangingEmail() {
  useLocale();
  return <Screen title={m.account_email_changing()} />;
}

/** The link has expired, was already used or replaced, belongs to another account, or its address is taken. */
export function InvalidEmailLinkScreen() {
  useLocale();
  return (
    <Screen title={m.auth_link_invalid_title()}>
      <p>{m.auth_link_invalid_body()}</p>
      <p>
        <Link href="/settings" className={authLinkClass}>
          {m.account_email_link_new()}
        </Link>
      </p>
    </Screen>
  );
}
