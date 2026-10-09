import * as React from 'react';
import { cn } from 'cn';
import { composeRenderProps, Input as InputPrimitive } from 'react-aria-components';

function Input({ className, type, ...props }: React.ComponentProps<typeof InputPrimitive>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={composeRenderProps(className, (resolved) =>
        cn(
          'h-8 w-full min-w-0 rounded-control border border-input bg-transparent px-2.5 py-1 text-base focus-ring transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-50 md:text-sm',
          resolved,
        ),
      )}
      {...props}
    />
  );
}

export { Input };
