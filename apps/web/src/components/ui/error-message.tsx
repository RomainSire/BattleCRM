import { cn } from 'cn';
import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { FieldError as FieldErrorPrimitive } from 'react-aria-components';

const errorTextClass = 'text-sm font-medium text-error';

/**
 * Every error of the app that is no field's own: a refusal of the API, a failure. In the Error colour,
 * with an icon so that the colour is never the only signal (spec UX §2); renders nothing without a message.
 */
function ErrorMessage({ className, children }: { className?: string; children?: ReactNode }) {
  // `false`, `null` and `''` are what `condition && message` leaves: nothing to say.
  const messages = [children]
    .flat()
    .filter((child) => child !== false && child != null && child !== '');
  if (messages.length === 0) return null;
  return (
    <p role="alert" className={cn('flex items-start gap-1.5', errorTextClass, className)}>
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{messages}</span>
    </p>
  );
}

/** The error of one field, under it; its `Input` takes the Error outline by itself (`data-invalid`). */
function FieldErrorMessage({ className }: { className?: string }) {
  return <FieldErrorPrimitive className={cn(errorTextClass, className)} />;
}

export { ErrorMessage, FieldErrorMessage };
