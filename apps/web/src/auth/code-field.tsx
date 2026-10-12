import { m } from '@battlecrm/i18n';
import { Text, TextField } from 'react-aria-components';

import { FieldErrorMessage } from '../components/ui/error-message.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';

/** What the authenticator app shows; anything else typed in a code field is a backup code. */
export const isTotpCode = (code: string) => /^\d{6}$/.test(code.replaceAll(/\s/g, ''));

/**
 * A code of the second factor (spec UX §5.9): six digits of the authenticator app or, unless
 * `digitsOnly`, a backup code. Pasting is allowed and a password manager may fill it.
 */
export function CodeField({
  label = m.auth_two_factor_code(),
  description,
  value,
  onChange,
  digitsOnly = false,
  inputClassName = '',
}: {
  label?: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  digitsOnly?: boolean;
  inputClassName?: string;
}) {
  return (
    <TextField
      name="code"
      value={value}
      onChange={onChange}
      autoComplete="one-time-code"
      {...(digitsOnly ? { inputMode: 'numeric' as const } : {})}
      isRequired
      className="flex flex-col gap-1.5"
    >
      <Label>{label}</Label>
      <Input autoCapitalize="none" spellCheck={false} className={inputClassName} />
      {description !== undefined && (
        <Text slot="description" className="text-sm text-muted-foreground">
          {description}
        </Text>
      )}
      <FieldErrorMessage />
    </TextField>
  );
}
