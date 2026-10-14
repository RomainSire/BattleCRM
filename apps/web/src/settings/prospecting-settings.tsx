import {
  DEFAULT_ACTIVITY_GOAL,
  DEFAULT_CIRCLE_SIZE_GOAL,
  DEFAULT_ENTRY_GOAL,
  FOLLOW_UP_INTERVALS_MAX,
  GOAL_MAX,
  SETTING_DAYS_MAX,
} from '@battlecrm/contract';
import { localDay, nextMondayAfter } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { Plus, X } from 'lucide-react';
import { useId } from 'react';

import { Button } from '../components/ui/button.tsx';
import { useLocale, type Locale } from '../i18n.ts';
import { CelebrateSetting } from './preferences-settings.tsx';
import { GoalSetting, NumberSetting, useDraft } from './setting-fields.tsx';
import { useChangeSettings, useSettings } from './use-settings.ts';

/** The next Monday as Settings say it: “Monday, Oct 12”, already a day of the User's time zone. */
const formatMonday = (day: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));

/** The Monday a change of the Entry goal applies from: the one after this week's, in the User's time zone. */
const nextMondayIn = (timeZone: string) => nextMondayAfter(localDay(new Date(), timeZone));

/** The goals and rhythms of prospecting (spec UX §5.8), each saved as soon as it changes. */
export function ProspectingSettings() {
  const locale = useLocale();
  const settings = useSettings();
  const { change } = useChangeSettings();
  const nextMonday = nextMondayIn(settings.timeZone.inEffect);
  return (
    <div className="flex flex-col gap-6">
      <GoalSetting
        title={m.settings_activity_goal()}
        countLabel={m.settings_activity_goal_count()}
        hint={m.settings_applies_tomorrow()}
        value={settings.activityGoal.chosen}
        fallback={DEFAULT_ACTIVITY_GOAL}
        maxValue={GOAL_MAX}
        onChange={(goal) => change({ activityGoal: goal }, m.settings_activity_goal)}
      />
      <CelebrateSetting />
      <DefaultCadence />
      <GoalSetting
        title={m.settings_entry_goal()}
        countLabel={m.settings_entry_goal_count()}
        hint={
          <>
            {m.settings_applies_from({ date: formatMonday(nextMonday, locale) })}{' '}
            {m.settings_entry_goal_hint()}
          </>
        }
        value={settings.entryGoal.chosen}
        fallback={DEFAULT_ENTRY_GOAL}
        maxValue={GOAL_MAX}
        onChange={(goal) => change({ entryGoal: goal }, m.settings_entry_goal)}
      />
      <NumberSetting
        label={m.settings_check_in_rhythm()}
        hint={m.settings_check_in_rhythm_hint()}
        value={settings.checkInRhythmDays}
        maxValue={SETTING_DAYS_MAX}
        onCommit={(days) => change({ checkInRhythmDays: days }, m.settings_check_in_rhythm)}
      />
      <GoalSetting
        title={m.settings_circle_size_goal()}
        countLabel={m.settings_circle_size_goal_count()}
        hint={m.settings_circle_size_goal_hint()}
        value={settings.circleSizeGoal}
        fallback={DEFAULT_CIRCLE_SIZE_GOAL}
        maxValue={GOAL_MAX}
        onChange={(goal) => change({ circleSizeGoal: goal }, m.settings_circle_size_goal)}
      />
    </div>
  );
}

/**
 * The Default follow-up cadence: intervals and Response window, no message (CONTEXT.md). The one
 * setting saved by a button (spec UX §5.8): a cadence is edited as a whole.
 */
function DefaultCadence() {
  useLocale();
  const titleId = useId();
  const hintId = useId();
  const { defaultCadence } = useSettings();
  const { saveWithoutUndo, isSaving } = useChangeSettings();
  const [draft, setDraft] = useDraft(defaultCadence);
  const isUnchanged = JSON.stringify(draft) === JSON.stringify(defaultCadence);
  const changeInterval = (rank: number, days: number) =>
    setDraft({ ...draft, intervals: draft.intervals.with(rank, days) });
  // No form: `Enter` in a field commits its number, and only the button saves.
  return (
    <section aria-labelledby={titleId} aria-describedby={hintId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 id={titleId} className="text-sm font-medium">
          {m.settings_default_cadence()}
        </h3>
        <p id={hintId} className="text-sm text-muted-foreground">
          {m.settings_default_cadence_hint()}
        </p>
      </div>
      <ol className="flex flex-wrap items-end gap-3">
        {draft.intervals.map((days, rank) => (
          // The rank is the identity of an interval: removing one renumbers those after it.
          // oxlint-disable-next-line react/no-array-index-key
          <li key={rank} className="flex items-end gap-1">
            <NumberSetting
              label={m.settings_cadence_interval({ rank: rank + 1 })}
              value={days}
              maxValue={SETTING_DAYS_MAX}
              onCommit={(committed) => changeInterval(rank, committed)}
            />
            {draft.intervals.length > 1 && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={m.settings_cadence_remove_interval({ rank: rank + 1 })}
                onPress={() =>
                  setDraft({ ...draft, intervals: draft.intervals.toSpliced(rank, 1) })
                }
              >
                <X />
              </Button>
            )}
          </li>
        ))}
      </ol>
      {draft.intervals.length < FOLLOW_UP_INTERVALS_MAX && (
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onPress={() =>
            setDraft({
              ...draft,
              intervals: [...draft.intervals, draft.intervals.at(-1) ?? draft.responseWindowDays],
            })
          }
        >
          <Plus aria-hidden />
          {m.settings_cadence_add_interval()}
        </Button>
      )}
      <NumberSetting
        label={m.settings_response_window()}
        value={draft.responseWindowDays}
        maxValue={SETTING_DAYS_MAX}
        onCommit={(responseWindowDays) => setDraft({ ...draft, responseWindowDays })}
      />
      <Button
        variant="outline"
        className="w-fit"
        isDisabled={isUnchanged || isSaving}
        onPress={() => saveWithoutUndo({ defaultCadence: draft }, m.settings_cadence_saved)}
      >
        {m.save()}
      </Button>
    </section>
  );
}
