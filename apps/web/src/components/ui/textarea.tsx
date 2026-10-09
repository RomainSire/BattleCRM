import * as React from 'react';
import { cn } from 'cn';
import { composeRenderProps, TextArea as TextareaPrimitive } from 'react-aria-components';

function Textarea({ className, ...props }: React.ComponentProps<typeof TextareaPrimitive>) {
  return (
    <TextareaPrimitive
      data-slot="textarea"
      className={composeRenderProps(className, (resolved) =>
        cn(
          'flex field-sizing-content min-h-16 w-full rounded-control border border-input bg-transparent px-2.5 py-2 text-base focus-ring transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-50 md:text-sm',
          resolved,
        ),
      )}
      {...props}
    />
  );
}

export { Textarea };
