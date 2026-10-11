import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-aria-components';

import { useLocale } from '../i18n.ts';
import { configQuery, useApi } from '../session.ts';
import { authLinkClass, AuthScreen } from './auth-layout.tsx';

// The sign-in form arrives with its ticket (07): for now, the screen every page without a session leads to.
export function SignInScreen() {
  useLocale();
  const { data: config } = useQuery(configQuery(useApi()));
  return (
    <AuthScreen title={m.auth_sign_in_title()}>
      {/* Closed sign-ups: the link disappears (spec UX §5.9). */}
      {config?.signupsOpen === true && (
        <p>
          <Link href="/sign-up" className={authLinkClass}>
            {m.auth_create_account()}
          </Link>
        </p>
      )}
    </AuthScreen>
  );
}
