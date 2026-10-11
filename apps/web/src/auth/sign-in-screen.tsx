import { m } from '@battlecrm/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRouteApi, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { Form, Link, TextField } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage, FieldErrorMessage } from '../components/ui/error-message.tsx';
import { Input, invalidInputClass } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { clearDeviceData } from '../device-data.ts';
import { useLocale } from '../i18n.ts';
import { configQuery, sessionQuery, useApi } from '../session.ts';
import { authLinkClass, AuthScreen } from './auth-layout.tsx';

const route = getRouteApi('/auth/sign-in');

type Outcome =
  { email: string } | { refused: 'invalid_credentials' | 'too_many_attempts' | 'error' };

export function SignInScreen() {
  useLocale();
  const api = useApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const search = route.useSearch();
  const { data: config } = useQuery(configQuery(api));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordShown, setPasswordShown] = useState(false);

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
      // Whatever a previous User left on this device goes before anything is shown.
      clearDeviceData(queryClient);
      queryClient.setQueryData(sessionQuery(api).queryKey, outcome);
      // Back to the page a deep link asked for (ST-22), Today otherwise.
      if (search.redirect === undefined) await router.navigate({ to: '/today', replace: true });
      else await router.navigate({ href: search.redirect, replace: true });
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
  };

  return (
    <AuthScreen title={m.auth_sign_in_title()}>
      <Form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          signIn.mutate();
        }}
      >
        <TextField
          name="email"
          value={email}
          onChange={edit(setEmail)}
          autoComplete="username"
          inputMode="email"
          validate={(value) =>
            /^\S+@\S+\.\S+$/.test(value.trim()) ? null : m.auth_email_invalid()
          }
          className="flex flex-col gap-1.5"
        >
          <Label>{m.auth_email()}</Label>
          <Input className={refusedInput} />
          <FieldErrorMessage />
        </TextField>
        {/* No rule on the password here: whatever is wrong gets the one message below (ST-13). */}
        <TextField
          name="password"
          type={passwordShown ? 'text' : 'password'}
          value={password}
          onChange={edit(setPassword)}
          autoComplete="current-password"
          isRequired
          className="flex flex-col gap-1.5"
        >
          <Label>{m.auth_password()}</Label>
          <div className="flex gap-2">
            <Input className={refusedInput} />
            <Button
              variant="outline"
              aria-pressed={passwordShown}
              onPress={() => setPasswordShown((shown) => !shown)}
            >
              {passwordShown ? m.auth_password_hide() : m.auth_password_show()}
            </Button>
          </div>
          <FieldErrorMessage />
        </TextField>
        <Button type="submit" isDisabled={signIn.isPending}>
          {m.auth_sign_in()}
        </Button>
        <ErrorMessage>
          {refused === 'invalid_credentials' && m.auth_sign_in_failed()}
          {refused === 'too_many_attempts' && m.auth_too_many_attempts()}
          {(signIn.isError || refused === 'error') && m.auth_error()}
        </ErrorMessage>
      </Form>
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
