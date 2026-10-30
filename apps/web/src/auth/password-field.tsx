import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import {
  FieldErrorMessage,
  InputGroup,
  InputGroupButton,
  InputGroupInput,
  Label,
  Tooltip,
  TooltipTrigger,
} from '@battlecrm/ui';
import { cn } from 'cn';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Text, TextField } from 'react-aria-components';

/**
 * A password, with its “Show” button inside the field: an eye, named by its label and its tooltip
 * (spec UX §5.9). A new one follows the only rule there is, its length,
 * and says so; the current one takes no rule: whatever is wrong with it is a wrong password (ST-13).
 * Nothing prevents pasting, and the `autocomplete` tells a password manager which of the two it is.
 */
export function PasswordField({
  name = 'password',
  label = m.auth_password(),
  value,
  onChange,
  isNew = false,
  groupClassName = '',
  toggleClassName = '',
}: {
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  isNew?: boolean;
  /** On the frame that holds the input and the button: it is what carries the outline. */
  groupClassName?: string;
  toggleClassName?: string;
}) {
  const [shown, setShown] = useState(false);
  const action = shown ? m.auth_password_hide() : m.auth_password_show();
  return (
    <TextField
      name={name}
      type={shown ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      autoComplete={isNew ? 'new-password' : 'current-password'}
      isRequired={!isNew}
      validate={(candidate) => {
        if (!isNew) return null;
        if (candidate.length < PASSWORD_MIN_LENGTH) return m.auth_password_help();
        if (candidate.length > PASSWORD_MAX_LENGTH) return m.auth_password_too_long();
        return null;
      }}
      className="flex flex-col gap-1.5"
    >
      <Label>{label}</Label>
      {/* The frame takes the focus ring and the Error outline of the input it holds. */}
      <InputGroup
        className={cn(
          'has-[input[data-invalid]]:border-error has-[input[data-invalid]]:ring-1 has-[input[data-invalid]]:ring-error',
          // One ring at a time: the button shows its own, inside the frame.
          'has-[button[data-focus-visible]]:outline-none!',
          groupClassName,
        )}
      >
        <InputGroupInput className="outline-none! data-invalid:ring-0" />
        <TooltipTrigger>
          <InputGroupButton
            size="icon-xs"
            className={cn('mr-1 text-muted-foreground -outline-offset-1!', toggleClassName)}
            aria-label={action}
            aria-pressed={shown}
            onPress={() => setShown((wasShown) => !wasShown)}
          >
            {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </InputGroupButton>
          <Tooltip>{action}</Tooltip>
        </TooltipTrigger>
      </InputGroup>
      {isNew && (
        <Text slot="description" className="text-sm text-muted-foreground">
          {m.auth_password_help()}
        </Text>
      )}
      <FieldErrorMessage />
    </TextField>
  );
}
