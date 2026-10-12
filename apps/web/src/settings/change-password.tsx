import { m } from '@battlecrm/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Form } from 'react-aria-components';

import { PasswordField } from '../auth/password-field.tsx';
import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { useLocale } from '../i18n.ts';
import { useApi } from '../session.ts';
import { sessionsQuery } from './connected-devices.tsx';

type Outcome =
  | 'changed'
  | 'wrong_password'
  | 'too_many_attempts'
  | 'password_compromised'
  | 'password_check_unavailable'
  | 'error';

/**
 * Changing the password (spec UX §5.9): a sensitive action, so the current password goes with the
 * request (ST-20). The other devices are signed out; this one stays.
 */
export function ChangePassword() {
  useLocale();
  const api = useApi();
  const queryClient = useQueryClient();
  const titleId = useId();
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  // A new form after each change: emptied fields that were never touched show no error.
  const [changes, setChanges] = useState(0);

  const change = useMutation({
    mutationFn: async (): Promise<Outcome> => {
      const response = await api.account.password.$post({ json: { password, newPassword } });
      if (response.status === 204) return 'changed';
      if (
        response.status === 400 ||
        response.status === 403 ||
        response.status === 429 ||
        response.status === 503
      ) {
        const { error } = await response.json();
        return error === 'invalid' ? 'error' : error;
      }
      return 'error';
    },
    onSuccess: (outcome) => {
      if (outcome !== 'changed') return;
      setPassword('');
      setNewPassword('');
      setChanges((count) => count + 1);
      // The other devices are gone from “Connected devices”.
      void queryClient.invalidateQueries({ queryKey: sessionsQuery(api).queryKey });
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
        {m.account_password_title()}
      </h3>
      <p className="text-sm text-muted-foreground">{m.account_password_body()}</p>
      <Form
        key={changes}
        aria-labelledby={titleId}
        className="flex flex-col gap-4"
        validationErrors={{
          ...(outcome === 'wrong_password' ? { password: m.account_wrong_password() } : {}),
          ...(outcome === 'password_compromised'
            ? { newPassword: m.auth_password_compromised() }
            : {}),
        }}
        onSubmit={(event) => {
          event.preventDefault();
          change.mutate();
        }}
      >
        <PasswordField
          label={m.account_current_password()}
          value={password}
          onChange={edit(setPassword)}
          groupClassName="max-md:h-auto"
          toggleClassName="max-md:size-11"
        />
        <PasswordField
          name="newPassword"
          label={m.auth_new_password()}
          value={newPassword}
          onChange={edit(setNewPassword)}
          isNew
          groupClassName="max-md:h-auto"
          toggleClassName="max-md:size-11"
        />
        <Button type="submit" className="self-start max-md:min-h-11" isDisabled={change.isPending}>
          {m.auth_change_password()}
        </Button>
        {/* Always there, so that a screen reader announces what appears in it. */}
        <output className="text-sm text-muted-foreground empty:sr-only">
          {outcome === 'changed' && m.account_password_changed()}
        </output>
        <ErrorMessage>
          {outcome === 'too_many_attempts' && m.account_too_many_attempts()}
          {outcome === 'password_check_unavailable' && m.auth_password_check_unavailable()}
          {(change.isError || outcome === 'error') && m.auth_error()}
        </ErrorMessage>
      </Form>
    </div>
  );
}
