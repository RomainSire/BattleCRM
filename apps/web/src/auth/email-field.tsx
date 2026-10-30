import { m } from '@battlecrm/i18n';
import { FieldErrorMessage, Input, Label } from '@battlecrm/ui';
import { TextField } from 'react-aria-components';

/** The address of an account, as every authentication screen asks for it. */
export function EmailField({
  label = m.auth_email(),
  value,
  onChange,
  autoComplete,
  inputClassName = '',
}: {
  label?: string;
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
      <Label>{label}</Label>
      <Input className={inputClassName} />
      <FieldErrorMessage />
    </TextField>
  );
}
