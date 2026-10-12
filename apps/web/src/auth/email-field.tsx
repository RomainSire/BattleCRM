import { m } from '@battlecrm/i18n';
import { TextField } from 'react-aria-components';

import { FieldErrorMessage } from '../components/ui/error-message.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';

/** The address of an account, as every authentication screen asks for it. */
export function EmailField({
  value,
  onChange,
  autoComplete,
  inputClassName = '',
}: {
  value: string;
  onChange: (value: string) => void;
  /** `username` where a password manager fills a sign-in, `email` elsewhere. */
  autoComplete: 'username' | 'email';
  inputClassName?: string;
}) {
  return (
    <TextField
      name="email"
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      inputMode="email"
      validate={(candidate) =>
        /^\S+@\S+\.\S+$/.test(candidate.trim()) ? null : m.auth_email_invalid()
      }
      className="flex flex-col gap-1.5"
    >
      <Label>{m.auth_email()}</Label>
      <Input className={inputClassName} />
      <FieldErrorMessage />
    </TextField>
  );
}
