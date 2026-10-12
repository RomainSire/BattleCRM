import { m } from '@battlecrm/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Form, Link } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { invalidInputClass } from '../components/ui/input.tsx';
import { clearDeviceData } from '../device-data.ts';
import { useLocale } from '../i18n.ts';
import { configQuery, sessionQuery, useApi } from '../session.ts';
import { authLinkClass, AuthScreen } from './auth-layout.tsx';
import { EmailField } from './email-field.tsx';
import { PasswordField } from './password-field.tsx';
import { SignInCode } from './sign-in-code.tsx';

const route = getRouteApi('/auth/sign-in');

type Outcome =
  | { email: string }
  | { twoFactorRequired: true }
  | { refused: 'invalid_credentials' | 'too_many_attempts' | 'error' };

export function SignInScreen() {
  useLocale();
  const api = useApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const search = route.useSearch();
  const { data: config } = useQuery(configQuery(api));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // With a second factor, the password opens nothing yet: a code is asked for next (ST-18).
  const [step, setStep] = useState<'password' | 'code' | 'expired'>('password');

  async function signedIn(session: { email: string }) {
    // Whatever a previous User left on this device goes before anything is shown.
    clearDeviceData(queryClient);
    queryClient.setQueryData(sessionQuery(api).queryKey, session);
    // Back to the page a deep link asked for (ST-22), Today otherwise.
    if (search.redirect === undefined) await router.navigate({ to: '/today', replace: true });
    else await router.navigate({ href: search.redirect, replace: true });
  }

  const signIn = useMutation({
    mutationFn: async (): Promise<Outcome> => {
      const response = await api.auth['sign-in'].email.$post({ json: { email, password } });
      if (response.status === 200) return response.json();
      if (response.status === 401 || response.status === 429) {
        return { refused: (await response.json()).error };
      }
      return { refused: 'error' };
    },
    onSuccess: async (outcome) => {
      if ('refused' in outcome) return;
      if ('twoFactorRequired' in outcome) setStep('code');
      else await signedIn(outcome);
    },
  });
  const refused =
    !signIn.isPending && signIn.data && 'refused' in signIn.data ? signIn.data.refused : undefined;
  // Which of the two is wrong is never said (ST-13): both fields take the Error outline.
  // The outline only: marking them invalid would have the browser hold the next attempt back.
  const refusedInput = refused === 'invalid_credentials' ? invalidInputClass : '';
  /** A refusal is about what was sent: it goes as soon as the User corrects it. */
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    if (signIn.data !== undefined) signIn.reset();
    if (step === 'expired') setStep('password');
  };

  if (step === 'code') {
    return (
      <AuthScreen title={m.auth_two_factor_title()}>
        <SignInCode
          onSignedIn={signedIn}
          onExpired={() => {
            signIn.reset();
            setStep('expired');
          }}
          onBack={() => {
            signIn.reset();
            setStep('password');
          }}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title={m.auth_sign_in_title()}>
      <Form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          signIn.mutate();
        }}
      >
        <EmailField
          value={email}
          onChange={edit(setEmail)}
          autoComplete="username"
          inputClassName={refusedInput}
        />
        {/* No rule on the password here: whatever is wrong gets the one message below (ST-13). */}
        <PasswordField
          value={password}
          onChange={edit(setPassword)}
          groupClassName={refusedInput}
        />
        <Button type="submit" isDisabled={signIn.isPending}>
          {m.auth_sign_in()}
        </Button>
        <ErrorMessage>
          {step === 'expired' && signIn.data === undefined && m.auth_two_factor_expired()}
          {refused === 'invalid_credentials' && m.auth_sign_in_failed()}
          {refused === 'too_many_attempts' && m.auth_too_many_attempts()}
          {(signIn.isError || refused === 'error') && m.auth_error()}
        </ErrorMessage>
      </Form>
      <p>
        <Link href="/forgot-password" className={authLinkClass}>
          {m.auth_forgot_password()}
        </Link>
      </p>
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
