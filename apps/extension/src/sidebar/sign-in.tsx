import { m } from '@battlecrm/i18n';
import {
  Button,
  CodeField,
  EmailField,
  ErrorMessage,
  invalidInputClass,
  PasswordField,
} from '@battlecrm/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Form } from 'react-aria-components';

import type { CodeOutcome, Session, SignInOutcome } from '../messages.ts';
import { ScreenTitle } from './layout.tsx';
import { useSend } from './send.tsx';

/**
 * The sign-in of the extension (spec extension §3): as the app's, e-mail and password, then a code of
 * the second factor if it is on. `expiredEmail`: the session ended, its address is filled in.
 * `onSession`: what the sidebar shows next, a session or a 426.
 */
export function SignIn({
  expiredEmail,
  onSession,
}: {
  expiredEmail?: string;
  onSession: (session: Session) => void;
}) {
  const send = useSend();
  const [email, setEmail] = useState(expiredEmail ?? '');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'password' | 'code' | 'challengeExpired'>('password');

  const signIn = useMutation({
    mutationFn: (): Promise<SignInOutcome> => send({ type: 'signIn', email, password }),
    onSuccess: (outcome) => {
      if (outcome.status === 'codeRequired') setStep('code');
      else if (outcome.status !== 'refused') onSession(outcome);
    },
  });
  const refused =
    !signIn.isPending && signIn.data?.status === 'refused' ? signIn.data.error : undefined;
  // Which of the two is wrong is never said (ST-13): both fields take the Error outline.
  const refusedInput = refused === 'invalid_credentials' ? invalidInputClass : '';
  /** A refusal is about what was sent: it goes as soon as the User corrects it. */
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    if (signIn.data !== undefined) signIn.reset();
    if (step === 'challengeExpired') setStep('password');
  };

  if (step === 'code') {
    return (
      <SignInCode
        onSession={onSession}
        onExpired={() => {
          signIn.reset();
          setStep('challengeExpired');
        }}
        onBack={() => {
          signIn.reset();
          setStep('password');
        }}
      />
    );
  }

  return (
    <>
      <ScreenTitle>{m.auth_sign_in_title()}</ScreenTitle>
      {expiredEmail !== undefined && <p>{m.extension_session_expired()}</p>}
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
        <PasswordField
          value={password}
          onChange={edit(setPassword)}
          groupClassName={refusedInput}
        />
        <Button type="submit" isDisabled={signIn.isPending}>
          {m.auth_sign_in()}
        </Button>
        <ErrorMessage>
          {step === 'challengeExpired' && signIn.data === undefined && m.auth_two_factor_expired()}
          {refused === 'invalid_credentials' && m.auth_sign_in_failed()}
          {refused === 'too_many_attempts' && m.auth_too_many_attempts()}
          {(signIn.isError || refused === 'error') && m.auth_error()}
        </ErrorMessage>
      </Form>
    </>
  );
}

/**
 * The second step: the password was right, a code of the app or a backup code opens the session.
 * “I lost my second factor” stays in the app: its request rests on the app's own cookie.
 */
function SignInCode({
  onSession,
  onExpired,
  onBack,
}: {
  onSession: (session: Session) => void;
  /** The first step no longer stands: it took too long, or too many wrong codes. */
  onExpired: () => void;
  onBack: () => void;
}) {
  const send = useSend();
  const [code, setCode] = useState('');

  const verify = useMutation({
    mutationFn: (): Promise<CodeOutcome> => send({ type: 'verifyCode', code }),
    onSuccess: (outcome) => {
      if (outcome.status !== 'refused') onSession(outcome);
      else if (outcome.error === 'challenge_expired') onExpired();
    },
  });
  const refused =
    !verify.isPending && verify.data?.status === 'refused' ? verify.data.error : undefined;

  return (
    <>
      <ScreenTitle>{m.auth_two_factor_title()}</ScreenTitle>
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
