import { m } from '@battlecrm/i18n';
import { notify, ToastRegion, toasts, type AppToast } from '@battlecrm/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useLocale } from './i18n.ts';
import { useIsOnline } from './online.ts';
import { useApi } from './session.ts';
import { useShortcuts } from './shortcuts.ts';
import { applySummaryChanges, SUMMARY_KEY } from './summary.ts';

/** What every gesture ends with: a notification that says what was done and offers “Undo” (spec UX §1). */
export function notifyGesture(message: string, undoToken: string): void {
  notify({ message, undoToken });
}

/** A notification whose gesture, or setting, can be taken back. */
type Undoable = { key: string } & ({ undoToken: string } | { undo: () => Promise<void> });

function undoable({ key, content: { undoToken, undo } }: AppToast): Undoable | undefined {
  if (undoToken !== undefined) return { key, undoToken };
  if (undo !== undefined) return { key, undo };
  return undefined;
}

/**
 * The notifications of the app and “Undo”: by the button of a notification, or by Ctrl Z for the
 * latest one still shown. A gesture is taken back on the server (ADR 0011); a setting is written
 * back as it was (spec UX §5.8).
 */
export function UndoToasts() {
  useLocale();
  const api = useApi();
  const queryClient = useQueryClient();
  // “Undo” saves too: offline, it waits for the connection (ADR 0004).
  const isOnline = useIsOnline();
  const undo = useMutation({
    mutationFn: async (toast: Undoable) => {
      // A setting is written back as it was: nothing to apply to the summary but what it stored.
      if ('undo' in toast) {
        await toast.undo();
        return 'written_back';
      }
      const { undoToken } = toast;
      const response = await api.gestures[':id'].undo.$post({ param: { id: undoToken } });
      if (response.status === 200) return (await response.json()).changes;
      // Too late, or a later gesture touched the same Contact: this device may be behind.
      if (response.status === 404 || response.status === 409) return 'refused';
      throw new Error('POST /api/gestures/:id/undo failed');
    },
    onSuccess: async (changes, { key }) => {
      toasts.close(key);
      if (changes === 'refused') {
        notify({ message: m.undo_too_late(), isError: true });
        await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
        return;
      }
      if (changes !== 'written_back') await applySummaryChanges(queryClient, changes);
      notify({ message: m.undone() });
    },
    // The notification stays: “Undo” can be tried again.
    onError: () => notify({ message: m.undo_failed(), isError: true }),
  });

  useShortcuts({
    '$mod+z': (event) => {
      const latest = toasts.visibleToasts.map(undoable).find((toast) => toast !== undefined);
      if (!latest || undo.isPending || !isOnline) return;
      event.preventDefault();
      undo.mutate(latest);
    },
  });

  return (
    <ToastRegion
      onUndo={(toast) => {
        const gesture = undoable(toast);
        if (gesture) undo.mutate(gesture);
      }}
      undoingKey={undo.isPending ? undo.variables.key : undefined}
    />
  );
}
