import { m } from '@battlecrm/i18n';
import { cn } from 'cn';
import { WifiOff } from 'lucide-react';

import { useIsOnline } from '../../online.ts';

/**
 * Why actions are disabled, said where they are (ADR 0004, ST-03); nothing online. Not an error, so
 * never in the Error colour (spec UX §2). `isLive` announces it as the connection drops.
 */
export function OfflineNote({
  isLive = false,
  className,
}: {
  isLive?: boolean;
  className?: string;
}) {
  const isOnline = useIsOnline();
  return (
    <div role={isLive ? 'status' : undefined} className={cn(isOnline && 'hidden', className)}>
      {!isOnline && (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{m.offline_read_only()}</span>
        </p>
      )}
    </div>
  );
}
