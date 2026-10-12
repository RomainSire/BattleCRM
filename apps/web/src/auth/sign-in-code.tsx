import { m } from '@battlecrm/i18n';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Form } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { useApi } from '../session.ts';
import { CodeField, isTotpCode } from './code-field.tsx';

type Outcome =
  | { email: string }
  | { refused: 'invalid_code' | 'challenge_expired' | 'too_many_attempts' | 'error' };

/**
 * The second step of a sign-in (spec UX §5.9): the password was right, a code of the second factor
 * opens the session. One field takes a code of the app or a backup code.
 */
export function SignInCode({
  onSignedIn,
  onExpired,
  onBack,
}: {
  onSignedIn: (session: { email: string }) => Promise<void>;
  /** The first step no longer stands: it took too long, or too many wrong codes. */
  onExpired: () => void;
  onBack: () => void;
}) {
  const api = useApi();
  const [code, setCode] = useState('');

  const verify = useMutation({
    mutationFn: async (): Promise<Outcome> => {
      const check = api.auth['two-factor'][isTotpCode(code) ? 'verify-totp' : 'verify-backup-code'];
      const response = await check.$post({ json: { code } });
      if (response.status === 200) return response.json();
      if (response.status === 401 || response.status === 429) {
        return { refused: (await response.json()).error };
      }
      // What is no code at all is a wrong code.
      return { refused: response.status === 400 ? 'invalid_code' : 'error' };
    },
    onSuccess: async (outcome) => {
      if (!('refused' in outcome)) await onSignedIn(outcome);
      else if (outcome.refused === 'challenge_expired') onExpired();
    },
  });
  const refused =
    !verify.isPending && verify.data && 'refused' in verify.data ? verify.data.refused : undefined;

  return (
    <>
      <Form
        className="flex flex-col gap-4"
        validationErrors={refused === 'invalid_code' ? { code: m.auth_two_factor_invalid() } : {}}
        onSubmit={(event) => {
          event.preventDefault();
          verify.mutate();
        }}
      >
        <CodeField
          description={m.auth_two_factor_body()}
          value={code}
          onChange={(value) => {
            setCode(value);
            // A refusal is about what was sent: it goes as soon as the User corrects it.
            if (verify.data !== undefined) verify.reset();
          }}
        />
        <Button type="submit" isDisabled={verify.isPending}>
          {m.auth_two_factor_submit()}
        </Button>
        <ErrorMessage>
          {refused === 'too_many_attempts' && m.account_too_many_attempts()}
          {(verify.isError || refused === 'error') && m.auth_error()}
        </ErrorMessage>
      </Form>
      <p>
        <Button variant="link" className="h-auto px-0 underline" onPress={onBack}>
          {m.auth_back_to_sign_in()}
        </Button>
      </p>
    </>
  );
}
