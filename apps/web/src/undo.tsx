import { m } from '@battlecrm/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notify, ToastRegion, toasts, type AppToast } from './components/ui/toast.tsx';
import { useLocale } from './i18n.ts';
import { useApi } from './session.ts';
import { useShortcuts } from './shortcuts.ts';
import { applySummaryChanges, SUMMARY_KEY } from './summary.ts';

/** What every gesture ends with: a notification that says what was done and offers “Undo” (spec UX §1). */
export function notifyGesture(message: string, undoToken: string): void {
  notify({ message, undoToken });
}

/** A notification whose gesture can be taken back. */
type Undoable = { key: string; undoToken: string };

const undoable = ({ key, content: { undoToken } }: AppToast): Undoable | undefined =>
  undoToken === undefined ? undefined : { key, undoToken };

/**
 * The notifications of the app and “Undo”: by the button of a notification, or by Ctrl Z for the
 * latest one still shown. The gesture is taken back on the server (ADR 0011).
 */
export function UndoToasts() {
  useLocale();
  const api = useApi();
  const queryClient = useQueryClient();
  const undo = useMutation({
    mutationFn: async ({ undoToken }: Undoable) => {
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
      await applySummaryChanges(queryClient, changes);
      notify({ message: m.undone() });
    },
    // The notification stays: “Undo” can be tried again.
    onError: () => notify({ message: m.undo_failed(), isError: true }),
  });

  useShortcuts({
    '$mod+z': (event) => {
      const latest = toasts.visibleToasts.map(undoable).find((toast) => toast !== undefined);
      if (!latest || undo.isPending) return;
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
