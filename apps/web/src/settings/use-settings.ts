import {
  DEFAULT_ACTIVITY_GOAL,
  DEFAULT_CELEBRATE_GOAL,
  DEFAULT_CHECK_IN_RHYTHM_DAYS,
  DEFAULT_CIRCLE_SIZE_GOAL,
  DEFAULT_ENTRY_GOAL,
  DEFAULT_FOLLOW_UP_INTERVALS,
  DEFAULT_RESPONSE_WINDOW_DAYS,
  DEFAULT_SINGLE_KEY_SHORTCUTS,
} from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { InferRequestType } from 'hono/client';
import type { KeybindingsMap } from 'tinykeys';

import { notify } from '../components/ui/toast.tsx';
import { changeLocale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { useShortcuts } from '../shortcuts.ts';
import { SUMMARY_KEY, summaryQuery, timeZoneOf, type Summary } from '../summary.ts';

/** Settings, as the summary carries them (spec UX §5.8). */
export type Settings = Summary['settings'];
/** A text of the notification, read once saved: in the language just chosen, if it changed. */
type Label = () => string;

/** What one save sends: only the settings it changes. */
export type SettingsChange = InferRequestType<ApiClient['settings']['$post']>['json'];

/**
 * What the app assumes until the summary says: a summary kept on the device from before Settings
 * carries none (ADR 0004). The language stays the device's own.
 */
function defaultSettings(summary: Summary | undefined): Omit<Settings, 'locale'> {
  const zone = timeZoneOf(summary);
  return {
    timeZone: { inEffect: zone, chosen: zone },
    activityGoal: { inEffect: DEFAULT_ACTIVITY_GOAL, chosen: DEFAULT_ACTIVITY_GOAL },
    entryGoal: { inEffect: DEFAULT_ENTRY_GOAL, chosen: DEFAULT_ENTRY_GOAL },
    celebrateGoal: DEFAULT_CELEBRATE_GOAL,
    singleKeyShortcuts: DEFAULT_SINGLE_KEY_SHORTCUTS,
    checkInRhythmDays: DEFAULT_CHECK_IN_RHYTHM_DAYS,
    circleSizeGoal: DEFAULT_CIRCLE_SIZE_GOAL,
    defaultCadence: {
      intervals: [...DEFAULT_FOLLOW_UP_INTERVALS],
      responseWindowDays: DEFAULT_RESPONSE_WINDOW_DAYS,
    },
  };
}

/** The settings of the User, from the summary; the defaults while it is read. `locale` is absent until the summary says. */
export function settingsOf(
  summary: Summary | undefined,
): Omit<Settings, 'locale'> & { locale?: Settings['locale'] } {
  // Fallback: a summary kept on the device by a version from before Settings carries none.
  const settings: Settings | undefined = summary?.settings;
  return settings ?? defaultSettings(summary);
}

export function useSettings() {
  return settingsOf(useQuery(summaryQuery(useApi())).data);
}

function storeSettings(queryClient: QueryClient, settings: Settings) {
  queryClient.setQueryData<Summary>(SUMMARY_KEY, (summary) => summary && { ...summary, settings });
}

/** The values a change replaces, as the User had chosen them: what “Undo” sends back. */
function before(settings: ReturnType<typeof settingsOf>, change: SettingsChange): SettingsChange {
  const previous: SettingsChange = {};
  if (change.locale !== undefined && settings.locale) previous.locale = settings.locale;
  if (change.timeZone !== undefined) previous.timeZone = settings.timeZone.chosen;
  if (change.activityGoal !== undefined) previous.activityGoal = settings.activityGoal.chosen;
  if (change.entryGoal !== undefined) previous.entryGoal = settings.entryGoal.chosen;
  if (change.celebrateGoal !== undefined) previous.celebrateGoal = settings.celebrateGoal;
  if (change.singleKeyShortcuts !== undefined) {
    previous.singleKeyShortcuts = settings.singleKeyShortcuts;
  }
  if (change.checkInRhythmDays !== undefined) {
    previous.checkInRhythmDays = settings.checkInRhythmDays;
  }
  if (change.circleSizeGoal !== undefined) previous.circleSizeGoal = settings.circleSizeGoal;
  if (change.defaultCadence !== undefined) previous.defaultCadence = settings.defaultCadence;
  return previous;
}

/**
 * Saves settings as soon as they change (spec UX §5.8), then offers “Undo”, which sends the values
 * from before: a value written back leaves no trace on the server. The language changes on this
 * device with the save.
 */
export function useChangeSettings() {
  const api = useApi();
  const queryClient = useQueryClient();
  const settings = useSettings();

  const send = async (change: SettingsChange): Promise<Settings> => {
    const response = await api.settings.$post({ json: change });
    if (!response.ok) throw new Error('POST /api/settings failed');
    const saved = (await response.json()).settings;
    storeSettings(queryClient, saved);
    if (change.locale !== undefined) await changeLocale(saved.locale);
    return saved;
  };

  const save = useMutation({
    mutationFn: ({ change }: { change: SettingsChange; label: Label; isUndoable: boolean }) =>
      send(change),
    onMutate: ({ change }) => ({ previous: before(settings, change) }),
    onSuccess: (_saved, { label, isUndoable }, context) => {
      if (!isUndoable) {
        notify({ message: label() });
        return;
      }
      notify({
        message: m.settings_saved({ setting: label() }),
        undo: async () => {
          await send(context.previous);
        },
      });
    },
    onError: () => notify({ message: m.settings_save_failed(), isError: true }),
  });

  return {
    /** Saves a change and offers “Undo”; `label` names the setting in the notification. */
    change: (change: SettingsChange, label: Label) =>
      save.mutate({ change, label, isUndoable: true }),
    /** Saves without “Undo”, behind a button (the Default follow-up cadence): `message` says it was saved. */
    saveWithoutUndo: (change: SettingsChange, message: Label) =>
      save.mutate({ change, label: message, isUndoable: false }),
    isSaving: save.isPending,
  };
}

/**
 * Shortcuts of a single key, which “Single-key shortcuts” turns off (spec UX §3.3): `N`, `/`, `?`,
 * `G` then a letter, `V`. `Ctrl K` and `Escape` go through `useShortcuts`, always on.
 */
export function useSingleKeyShortcuts(bindings: KeybindingsMap): void {
  const { singleKeyShortcuts } = useSettings();
  useShortcuts(
    Object.fromEntries(
      Object.entries(bindings).map(([keys, handler]) => [
        keys,
        (event: KeyboardEvent) => {
          if (singleKeyShortcuts) handler(event);
        },
      ]),
    ),
  );
}
