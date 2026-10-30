import { cn } from 'cn';
import { Radio, RadioGroup, type RadioGroupProps, type RadioProps } from 'react-aria-components';

/** A choice of one among a few, side by side: radios that look like a row of buttons. */
function SegmentedControl({
  className,
  ...props
}: Omit<RadioGroupProps, 'className' | 'orientation'> & { className?: string }) {
  return (
    <RadioGroup
      data-slot="segmented-control"
      orientation="horizontal"
      className={cn('flex flex-col gap-1.5', className)}
      {...props}
    />
  );
}

/** The row of segments, under the label of the control. */
function SegmentedControlItems({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex w-fit max-w-full rounded-control border border-input p-0.5', className)}
      {...props}
    />
  );
}

function SegmentedControlItem({
  className,
  ...props
}: Omit<RadioProps, 'className'> & { className?: string }) {
  return (
    <Radio
      data-slot="segmented-control-item"
      className={cn(
        'flex h-7 cursor-default items-center rounded-[calc(var(--radius-control)-2px)] px-3 text-sm text-muted-foreground transition-colors select-none data-focus-visible:outline-2 data-focus-visible:outline-offset-1 data-focus-visible:outline-accent data-hovered:text-foreground data-selected:bg-accent data-selected:font-medium data-selected:text-accent-foreground max-md:h-10',
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem, SegmentedControlItems };
