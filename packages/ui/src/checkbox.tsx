import { cn } from 'cn';
import { Check } from 'lucide-react';
import { Checkbox as CheckboxPrimitive, type CheckboxProps } from 'react-aria-components';

function Checkbox({
  className,
  children,
  ...props
}: Omit<CheckboxProps, 'className' | 'children'> & {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <CheckboxPrimitive
      data-slot="checkbox"
      className={cn('group/checkbox flex items-center gap-2 text-sm select-none', className)}
      {...props}
    >
      <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input group-data-focus-visible/checkbox:outline-2 group-data-focus-visible/checkbox:outline-offset-2 group-data-focus-visible/checkbox:outline-accent group-data-selected/checkbox:border-accent group-data-selected/checkbox:bg-accent group-data-selected/checkbox:text-accent-foreground">
        <Check aria-hidden className="hidden size-3 group-data-selected/checkbox:block" />
      </span>
      {children}
    </CheckboxPrimitive>
  );
}

export { Checkbox };
