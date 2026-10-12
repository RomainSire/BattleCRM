import { m } from '@battlecrm/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useState } from 'react';
import { Form, Link } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { clearDeviceData } from '../device-data.ts';
import { useLocale } from '../i18n.ts';
import { sessionQuery, useApi } from '../session.ts';
import { authLinkClass, AuthScreen } from './auth-layout.tsx';
import { PasswordField } from './password-field.tsx';

type Outcome =
  | { email: string }
  | { refused: 'invalid_link' | 'password_compromised' | 'password_check_unavailable' | 'error' };

/**
 * The link of the reset e-mail (spec UX §5.9). Its token travels in the fragment, which reaches no server
 * log, and is only sent with the new password: opening the link uses nothing up. A new password signs
 * this device in and every other one out.
 */
export function ResetPasswordScreen() {
  useLocale();
  const api = useApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  const token = useRouterState({ select: (state) => state.location.hash });
  const [password, setPassword] = useState('');

  const reset = useMutation({
    mutationFn: async (): Promise<Outcome> => {
      const response = await api['password-reset'].complete.$post({ json: { token, password } });
      if (response.status === 200) return response.json();
      if (response.status === 400 || response.status === 503) {
        const { error } = await response.json();
        return { refused: error === 'invalid' ? 'error' : error };
      }
      return { refused: 'error' };
    },
    onSuccess: async (outcome) => {
      if ('refused' in outcome) return;
      // Whatever a previous User left on this device goes before anything is shown.
      clearDeviceData(queryClient);
      queryClient.setQueryData(sessionQuery(api).queryKey, outcome);
      await router.navigate({ to: '/today', replace: true });
    },
  });
  const refused = reset.data && 'refused' in reset.data ? reset.data.refused : undefined;

  // Expired, already used, replaced by a later one, or no token at all.
  if (token === '' || refused === 'invalid_link') {
    return (
      <AuthScreen title={m.auth_link_invalid_title()}>
        <p>{m.auth_link_invalid_body()}</p>
        <p className="flex flex-col items-start gap-2">
          <Link href="/forgot-password" className={authLinkClass}>
            {m.auth_reset_link_new()}
          </Link>
          <Link href="/sign-in" className={authLinkClass}>
            {m.auth_sign_in()}
          </Link>
        </p>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title={m.auth_reset_password_title()}>
      <Form
        className="flex flex-col gap-4"
        validationErrors={
          refused === 'password_compromised' ? { password: m.auth_password_compromised() } : {}
        }
        onSubmit={(event) => {
          event.preventDefault();
          reset.mutate();
        }}
      >
        <PasswordField
          label={m.auth_new_password()}
          value={password}
          onChange={setPassword}
          isNew
        />
        <Button type="submit" isDisabled={reset.isPending}>
          {m.auth_change_password()}
        </Button>
        <ErrorMessage>
          {refused === 'password_check_unavailable' && m.auth_password_check_unavailable()}
          {(reset.isError || refused === 'error') && m.auth_error()}
        </ErrorMessage>
      </Form>
    </AuthScreen>
  );
}
