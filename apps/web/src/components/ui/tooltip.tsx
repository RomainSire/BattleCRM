import { cn } from 'cn';
import {
  Tooltip as TooltipPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
  type TooltipProps,
  type TooltipTriggerComponentProps,
} from 'react-aria-components';

/** Wraps a focusable control and its `Tooltip`: shown on hover after a short delay, at once on keyboard focus. */
function TooltipTrigger({ delay = 400, ...props }: TooltipTriggerComponentProps) {
  return <TooltipTriggerPrimitive delay={delay} {...props} />;
}

/** What a control does, for a control that only shows an icon; never the only place its name lives. */
function Tooltip({
  className,
  offset = 6,
  ...props
}: Omit<TooltipProps, 'className'> & { className?: string }) {
  // Drawn inside the page's `main`: content outside every landmark is lost to some screen readers.
  const main = document.getElementById('main');
  return (
    <TooltipPrimitive
      data-slot="tooltip"
      offset={offset}
      className={cn(
        'rounded-control bg-foreground px-2 py-1 text-xs font-medium text-background shadow-sm',
        className,
      )}
      {...(main ? { UNSTABLE_portalContainer: main } : {})}
      {...props}
    />
  );
}

export { Tooltip, TooltipTrigger };
