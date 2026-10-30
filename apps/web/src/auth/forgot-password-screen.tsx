import { m } from '@battlecrm/i18n';
import { Button, ErrorMessage } from '@battlecrm/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Form, Link } from 'react-aria-components';

import { useLocale } from '../i18n.ts';
import { useApi } from '../session.ts';
import { authLinkClass, AuthScreen } from './auth-layout.tsx';
import { EmailField } from './email-field.tsx';

/**
 * “Forgot your password?” (spec UX §5.9): the answer is the same whether the address has an account
 * or not (ST-13). Open with a session too: “It wasn't me”, in a security e-mail, leads here.
 */
export function ForgotPasswordScreen() {
  useLocale();
  const api = useApi();
  const [email, setEmail] = useState('');
  const ask = useMutation({
    mutationFn: async () => {
      const response = await api['password-reset'].$post({ json: { email } });
      if (!response.ok) throw new Error(`POST /api/password-reset answered ${response.status}`);
    },
  });

  return (
    <AuthScreen title={m.auth_forgot_password_title()}>
      {!ask.isSuccess && (
        <Form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            ask.mutate();
          }}
        >
          <p>{m.auth_forgot_password_body()}</p>
          <EmailField value={email} onChange={setEmail} autoComplete="email" />
          <Button type="submit" isDisabled={ask.isPending}>
            {m.auth_forgot_password_send()}
          </Button>
          <ErrorMessage>{ask.isError && m.auth_error()}</ErrorMessage>
        </Form>
      )}
      {/* Always there, so that a screen reader announces what appears in it. */}
      <output className="empty:sr-only">{ask.isSuccess && m.auth_forgot_password_sent()}</output>
      <p>
        <Link href="/sign-in" className={authLinkClass}>
          {m.auth_back_to_sign_in()}
        </Link>
      </p>
    </AuthScreen>
  );
}
