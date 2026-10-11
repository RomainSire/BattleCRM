import { m } from '@battlecrm/i18n';
import { Link } from 'react-aria-components';

import { useLocale } from '../i18n.ts';
import { authLinkClass, AuthScreen } from './auth-layout.tsx';

/** Shown while the link of the e-mail is being checked; a valid one leads straight to Today. */
export function VerifyingEmail() {
  useLocale();
  return <AuthScreen title={m.auth_verifying()} />;
}

/** The link has expired, was already used, or its address has an account by now. */
export function InvalidLinkScreen() {
  useLocale();
  return (
    <AuthScreen title={m.auth_link_invalid_title()}>
      <p>{m.auth_link_invalid_body()}</p>
      <p className="flex flex-col items-start gap-2">
        <Link href="/sign-up" className={authLinkClass}>
          {m.auth_link_invalid_restart()}
        </Link>
        <Link href="/sign-in" className={authLinkClass}>
          {m.auth_sign_in()}
        </Link>
      </p>
    </AuthScreen>
  );
}

/** The API could not be reached, or failed. */
export function AuthError() {
  useLocale();
  return (
    <AuthScreen title="BattleCRM">
      <p role="alert">{m.auth_error()}</p>
    </AuthScreen>
  );
}
