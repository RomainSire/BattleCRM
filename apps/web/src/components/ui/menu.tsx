import { m } from '@battlecrm/i18n';
import { cn } from 'cn';
import { Ellipsis } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Menu as MenuPrimitive,
  MenuItem as MenuItemPrimitive,
  MenuTrigger,
  Popover,
  type Key,
} from 'react-aria-components';

import { Button } from './button.tsx';

/** `⋯`: the actions that are not on the screen, in a menu (spec UX §5.3). */
function MoreActions({
  onAction,
  children,
  className,
}: {
  onAction: (key: Key) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <MenuTrigger>
      <Button
        variant="outline"
        size="icon"
        aria-label={m.more_actions()}
        className={cn('max-md:size-11', className)}
      >
        <Ellipsis />
      </Button>
      <Popover
        placement="bottom end"
        className="min-w-48 rounded-card bg-background p-1 text-sm text-foreground shadow-lg ring-1 ring-border outline-none"
      >
        <MenuPrimitive onAction={onAction} className="outline-none">
          {children}
        </MenuPrimitive>
      </Popover>
    </MenuTrigger>
  );
}

function MenuItem({ id, children }: { id: Key; children: ReactNode }) {
  return (
    <MenuItemPrimitive
      id={id}
      className="cursor-default rounded-control px-2 py-1.5 outline-none data-focused:bg-surface max-md:py-3"
    >
      {children}
    </MenuItemPrimitive>
  );
}

export { MenuItem, MoreActions };
