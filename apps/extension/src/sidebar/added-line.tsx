import { m } from '@battlecrm/i18n';
import { Button, ErrorMessage } from '@battlecrm/ui';
import { useEffect, useState } from 'react';

/** As long as the notifications of the app: at least 10 s (spec UX §1). */
export const ADDED_LINE_MS = 10_000;

/**
 * The line after an addition (spec extension §4): what was added and “Undo”. It goes after 10 s
 * without the pointer or the focus on it, never while an undo failed; each pause starts the 10 s again.
 */
export function AddedLine({
  message,
  onUndo,
  isUndoing,
  error,
  onEnd,
}: {
  message: string;
  onUndo: () => void;
  isUndoing: boolean;
  /** Why the undo failed, if it did. */
  error: string | false;
  onEnd: () => void;
}) {
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const isPaused = isHovered || isFocused || isUndoing || error !== false;
  useEffect(() => {
    if (isPaused) return undefined;
    const timer = setTimeout(onEnd, ADDED_LINE_MS);
    return () => clearTimeout(timer);
  }, [isPaused, onEnd]);
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- the pointer only pauses it.
    <div
      className="flex flex-col gap-2 rounded-lg border bg-surface p-3 text-sm"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Announced politely, as the notifications of the app (spec UX §7). */}
        <output>{message}</output>
        <Button variant="outline" size="sm" isDisabled={isUndoing} onPress={onUndo}>
          {m.undo()}
        </Button>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </div>
  );
}
