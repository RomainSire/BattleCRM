import { m } from '@battlecrm/i18n';
import { XIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import {
  Text,
  UNSTABLE_Toast as ToastPrimitive,
  UNSTABLE_ToastContent as ToastContentPrimitive,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegionPrimitive,
  type QueuedToast,
} from 'react-aria-components';

import { Button } from './button.tsx';
import { ErrorMessage } from './error-message.tsx';

// Hand-written on React Aria's toast (spec stack §3): its timers stop while the region is hovered
// or holds the focus, which no ready-made toast did (ST-62).

/**
 * What a notification says; `undoToken` gives it “Undo” for a gesture taken back on the server (ADR
 * 0011), `undo` for a setting written back (spec UX §5.8); `isError` the Error colour (spec UX §2).
 */
export type ToastContent = {
  message: string;
  undoToken?: string;
  undo?: () => Promise<void>;
  isError?: boolean;
};
export type AppToast = QueuedToast<ToastContent>;

/** At least 10 s (spec UX §1). */
const TOAST_TIMEOUT_MS = 10_000;

export const toasts = new ToastQueue<ToastContent>({ maxVisibleToasts: 3 });

export function notify(content: ToastContent): void {
  toasts.add(content, { timeout: TOAST_TIMEOUT_MS });
}

/** The notifications of the app, above everything else; rendered once, by the shell. */
export function ToastRegion({
  onUndo,
  undoingKey,
}: {
  onUndo: (toast: AppToast) => void;
  /** The notification whose undo is under way. */
  undoingKey: string | undefined;
}) {
  return (
    <ToastRegionPrimitive
      queue={toasts}
      aria-label={m.notifications()}
      className="fixed inset-x-4 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-50 flex flex-col-reverse gap-2 rounded-card focus-ring md:inset-x-auto md:right-4 md:bottom-4 md:w-96"
    >
      {({ toast }) => <Toast toast={toast} onUndo={onUndo} isUndoing={undoingKey === toast.key} />}
    </ToastRegionPrimitive>
  );
}

function Toast({
  toast,
  onUndo,
  isUndoing,
}: {
  toast: AppToast;
  onUndo: (toast: AppToast) => void;
  isUndoing: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // React Aria stops the timers when the pointer or the focus enters the region. A notification that
  // shows while one of them is already there starts its own: it has to wait like the others.
  useEffect(() => {
    const region = ref.current?.closest('[role="region"]');
    if (region?.matches(':hover') || region?.contains(document.activeElement)) toasts.pauseAll();
  }, []);
  return (
    <ToastPrimitive
      ref={ref}
      toast={toast}
      className="flex items-center gap-2 rounded-card bg-background py-2 pr-2 pl-3 text-sm text-foreground shadow-lg ring-1 ring-border focus-ring"
    >
      {/* Announced politely (spec UX §7); an error is announced by its own message, at once. */}
      <ToastContentPrimitive
        role={toast.content.isError ? 'none' : 'status'}
        className="min-w-0 flex-1"
      >
        <Text slot="title" elementType="div">
          {toast.content.isError ? (
            <ErrorMessage>{toast.content.message}</ErrorMessage>
          ) : (
            toast.content.message
          )}
        </Text>
      </ToastContentPrimitive>
      {(toast.content.undoToken !== undefined || toast.content.undo !== undefined) && (
        <Button
          variant="outline"
          size="sm"
          className="max-md:min-h-11"
          aria-keyshortcuts="Control+Z"
          isDisabled={isUndoing}
          onPress={() => onUndo(toast)}
        >
          {m.undo()}
        </Button>
      )}
      <Button
        slot="close"
        variant="ghost"
        size="icon-sm"
        className="max-md:size-11"
        aria-label={m.close()}
      >
        <XIcon />
      </Button>
    </ToastPrimitive>
  );
}
