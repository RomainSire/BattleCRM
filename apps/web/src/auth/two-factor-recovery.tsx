import { m } from '@battlecrm/i18n';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { useLocale } from '../i18n.ts';
import { useApi } from '../session.ts';
import { authLinkClass, AuthScreen } from './auth-layout.tsx';

type Outcome = { dueAt: string } | { refused: 'challenge_expired' | 'error' };

/**
 * The second factor is lost (spec UX §5.9, ST-19): from the code screen, the User who has neither the
 * app nor a backup code asks for it to be turned off. Nothing happens for 7 days, and an e-mail lets
 * cancel: the screen says both before anything is asked.
 */
export function RecoveryRequest({
  onExpired,
  onBackToCode,
}: {
  /** The first step no longer stands: the password is asked again. */
  onExpired: () => void;
  onBackToCode: () => void;
}) {
  const locale = useLocale();
  const api = useApi();
  const ask = useMutation({
    mutationFn: async (): Promise<Outcome> => {
      // No body: the challenge the password left says whose second factor it is.
      const response = await api['two-factor-recovery'].$post();
      if (response.status === 200) return response.json();
      return { refused: response.status === 401 ? 'challenge_expired' : 'error' };
    },
    onSuccess: (outcome) => {
      if ('refused' in outcome && outcome.refused === 'challenge_expired') onExpired();
    },
  });

  const refused = ask.data && 'refused' in ask.data ? ask.data.refused : undefined;

  if (ask.data && 'dueAt' in ask.data) {
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
      new Date(ask.data.dueAt),
    );
    return <output>{m.auth_recovery_requested({ date })}</output>;
  }

  return (
    <>
      <p>{m.auth_recovery_body()}</p>
      <Button isDisabled={ask.isPending} onPress={() => ask.mutate()}>
        {m.auth_recovery_request()}
      </Button>
      <ErrorMessage>
        {!ask.isPending && (ask.isError || refused === 'error') && m.auth_error()}
      </ErrorMessage>
      <p>
        <Button variant="link" className="h-auto px-0 underline" onPress={onBackToCode}>
          {m.auth_recovery_back_to_code()}
        </Button>
      </p>
    </>
  );
}

/** Shown while the link of the e-mail is being checked. */
export function CancellingRecovery() {
  useLocale();
  return <AuthScreen title={m.auth_recovery_cancelling()} />;
}

/**
 * Where “Cancel” of a recovery e-mail leads. Whoever cancels a request made by someone else is told
 * what the request means: that someone knows the password.
 */
export function RecoveryCancelledScreen({ cancelled }: { cancelled: boolean }) {
  useLocale();
  // Expired, already used, or the recovery ended some other way.
  if (!cancelled) {
    return (
      <AuthScreen title={m.auth_link_invalid_title()}>
        <p>{m.auth_link_invalid_body()}</p>
        <p>
          <Link href="/sign-in" className={authLinkClass}>
            {m.auth_sign_in()}
          </Link>
        </p>
      </AuthScreen>
    );
  }
  return (
    <AuthScreen title={m.auth_recovery_cancelled_title()}>
      <p>{m.auth_recovery_cancelled_body()}</p>
      <p>
        <Link href="/forgot-password" className={authLinkClass}>
          {m.auth_recovery_new_password()}
        </Link>
      </p>
    </AuthScreen>
  );
}
