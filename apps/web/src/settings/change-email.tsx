import { m } from '@battlecrm/i18n';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Form } from 'react-aria-components';

import { EmailField } from '../auth/email-field.tsx';
import { PasswordField } from '../auth/password-field.tsx';
import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { useLocale } from '../i18n.ts';
import { sessionQuery, useApi } from '../session.ts';

type Outcome = { sentTo: string } | 'same_email' | 'wrong_password' | 'too_many_attempts' | 'error';

/**
 * Changing the address of the account (spec UX §5.9): a sensitive action, so the current password goes
 * with the request (ST-20). Nothing changes until the link sent to the new address is clicked, and the
 * answer is the same whether that address is free or taken.
 */
export function ChangeEmail() {
  useLocale();
  const api = useApi();
  const titleId = useId();
  const { data: session } = useQuery(sessionQuery(api));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // A new form after each request: emptied fields that were never touched show no error.
  const [requests, setRequests] = useState(0);

  const change = useMutation({
    mutationFn: async (): Promise<Outcome> => {
      // The API would answer as for any other address, and no link would leave.
      if (email.trim().toLowerCase() === session?.email) return 'same_email';
      const response = await api.account.email.$post({ json: { password, email } });
      if (response.status === 204) return { sentTo: email.trim() };
      if (response.status === 403 || response.status === 429) return (await response.json()).error;
      return 'error';
    },
    onSuccess: (outcome) => {
      if (typeof outcome === 'string') return;
      setEmail('');
      setPassword('');
      setRequests((count) => count + 1);
    },
  });
  const outcome = change.isPending ? undefined : change.data;
  /** An answer is about what was sent: it goes as soon as the User types again. */
  const edit = (set: (value: string) => void) => (value: string) => {
    set(value);
    if (change.data !== undefined) change.reset();
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 id={titleId} className="text-sm font-medium">
        {m.account_email_title()}
      </h3>
      <p className="text-sm text-muted-foreground">
        {session && <span className="block">{m.account_email_current(session)}</span>}
        {m.account_email_body()}
      </p>
      <Form
        key={requests}
        aria-labelledby={titleId}
        className="flex flex-col gap-4"
        validationErrors={{
          ...(outcome === 'same_email' ? { email: m.account_email_same() } : {}),
          ...(outcome === 'wrong_password' ? { password: m.account_wrong_password() } : {}),
        }}
        onSubmit={(event) => {
          event.preventDefault();
          change.mutate();
        }}
      >
        <EmailField
          label={m.account_new_email()}
          value={email}
          onChange={edit(setEmail)}
          autoComplete="email"
          inputClassName="max-md:h-11"
        />
        <PasswordField
          label={m.account_current_password()}
          value={password}
          onChange={edit(setPassword)}
          groupClassName="max-md:h-auto"
          toggleClassName="max-md:size-11"
        />
        <Button type="submit" className="self-start max-md:min-h-11" isDisabled={change.isPending}>
          {m.account_change_email()}
        </Button>
        {/* Always there, so that a screen reader announces what appears in it. */}
        <output className="text-sm text-muted-foreground empty:sr-only">
          {typeof outcome === 'object' && m.account_email_sent({ email: outcome.sentTo })}
        </output>
        <ErrorMessage>
          {outcome === 'too_many_attempts' && m.account_too_many_attempts()}
          {(change.isError || outcome === 'error') && m.auth_error()}
        </ErrorMessage>
      </Form>
    </div>
  );
}
