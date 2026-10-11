import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import { getLocale } from '@battlecrm/i18n/runtime';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Form, Link, Text, TextField } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage, FieldErrorMessage } from '../components/ui/error-message.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { useLocale } from '../i18n.ts';
import { configQuery, useApi } from '../session.ts';
import { authLinkClass, AuthScreen } from './auth-layout.tsx';
import { CheckInbox } from './check-inbox.tsx';

type Refusal = 'password_compromised' | 'password_check_unavailable' | 'signups_closed' | 'error';

export function SignUpScreen() {
  useLocale();
  const api = useApi();
  const queryClient = useQueryClient();
  const { data: config, isPending: configPending } = useQuery(configQuery(api));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordShown, setPasswordShown] = useState(false);
  const [attemptId, setAttemptId] = useState<string>();

  const signUp = useMutation({
    mutationFn: async (): Promise<{ attemptId: string } | { refused: Refusal }> => {
      const response = await api.signup.$post({
        json: {
          email,
          password,
          locale: getLocale(),
          // Detected, never asked for (spec UX §5.9).
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      if (response.status === 202) return response.json();
      if (response.status === 400 || response.status === 403 || response.status === 503) {
        const { error } = await response.json();
        return { refused: error === 'invalid' ? 'error' : error };
      }
      return { refused: 'error' };
    },
    onSuccess: (outcome) => {
      if ('attemptId' in outcome) setAttemptId(outcome.attemptId);
      // The door closed since the page opened.
      else if (outcome.refused === 'signups_closed')
        queryClient.setQueryData(configQuery(api).queryKey, { signupsOpen: false });
    },
  });
  const refused = signUp.data && 'refused' in signUp.data ? signUp.data.refused : undefined;
  const failed = signUp.isError || refused === 'error';

  if (attemptId !== undefined) {
    return (
      <CheckInbox
        attemptId={attemptId}
        email={email.trim()}
        onWrongAddress={() => {
          setAttemptId(undefined);
          signUp.reset();
        }}
      />
    );
  }

  if (configPending) return <AuthScreen title={m.auth_create_account()} />;

  if (config?.signupsOpen !== true) {
    return (
      <AuthScreen title={m.auth_create_account()}>
        <p>{config === undefined ? m.auth_error() : m.auth_signups_closed()}</p>
        <SignInLink />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title={m.auth_create_account()}>
      <Form
        className="flex flex-col gap-4"
        validationErrors={
          refused === 'password_compromised' ? { password: m.auth_password_compromised() } : {}
        }
        onSubmit={(event) => {
          event.preventDefault();
          signUp.mutate();
        }}
      >
        <TextField
          name="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          inputMode="email"
          validate={(value) =>
            /^\S+@\S+\.\S+$/.test(value.trim()) ? null : m.auth_email_invalid()
          }
          className="flex flex-col gap-1.5"
        >
          <Label>{m.auth_email()}</Label>
          <Input />
          <FieldErrorMessage />
        </TextField>
        <TextField
          name="password"
          type={passwordShown ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          validate={(value) => {
            if (value.length < PASSWORD_MIN_LENGTH) return m.auth_password_help();
            if (value.length > PASSWORD_MAX_LENGTH) return m.auth_password_too_long();
            return null;
          }}
          className="flex flex-col gap-1.5"
        >
          <Label>{m.auth_password()}</Label>
          <div className="flex gap-2">
            <Input />
            <Button
              variant="outline"
              aria-pressed={passwordShown}
              onPress={() => setPasswordShown((shown) => !shown)}
            >
              {passwordShown ? m.auth_password_hide() : m.auth_password_show()}
            </Button>
          </div>
          <Text slot="description" className="text-sm text-muted-foreground">
            {m.auth_password_help()}
          </Text>
          <FieldErrorMessage />
        </TextField>
        <Button type="submit" isDisabled={signUp.isPending}>
          {m.auth_create_account()}
        </Button>
        <ErrorMessage>
          {refused === 'password_check_unavailable' && m.auth_password_check_unavailable()}
          {failed && m.auth_error()}
        </ErrorMessage>
      </Form>
      <SignInLink />
    </AuthScreen>
  );
}

function SignInLink() {
  return (
    <p className="text-sm">
      {m.auth_have_account()}{' '}
      <Link href="/sign-in" className={authLinkClass}>
        {m.auth_sign_in()}
      </Link>
    </p>
  );
}
