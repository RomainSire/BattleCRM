import { m } from '@battlecrm/i18n';
import {
  Label,
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
  notify,
} from '@battlecrm/ui';
import { useId } from 'react';

import { locales, useLocale, type Locale } from '../i18n.ts';
import { useIsOnline } from '../online.ts';
import { useTheme, type ThemePreference } from '../theme/theme-provider.tsx';
import { ToggleSetting } from './setting-fields.tsx';
import { useChangeSettings, useSettings } from './use-settings.ts';

// Each language is named in itself, whatever the current one.
export const LANGUAGE_NAMES: Record<Locale, string> = { fr: 'Français', en: 'English' };

const selectClass =
  'h-8 w-fit max-w-full rounded-control border border-input bg-background px-2 text-sm text-foreground focus-ring disabled:opacity-50 max-md:h-11';

/** The language of the User (ST-50): the interface and the e-mails, on every device. */
export function LanguageSetting() {
  const locale = useLocale();
  const id = useId();
  const { change } = useChangeSettings();
  // Saved on the server: offline, it is only read (ADR 0004).
  const isOnline = useIsOnline();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{m.language()}</Label>
      <select
        id={id}
        value={locale}
        disabled={!isOnline}
        onChange={(event) => {
          const chosen = locales.find((candidate) => candidate === event.target.value);
          if (chosen) change({ locale: chosen }, m.language);
        }}
        className={selectClass}
      >
        {locales.map((candidate) => (
          <option key={candidate} value={candidate} lang={candidate}>
            {LANGUAGE_NAMES[candidate]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Every time zone the browser knows, and the one chosen even if it does not. */
function timeZones(chosen: string): string[] {
  const known = Intl.supportedValuesOf('timeZone');
  return known.includes(chosen) ? known : [chosen, ...known];
}

/** The time zone of the User (ST-51): from tomorrow on, the past keeps its own. */
function TimeZoneSetting() {
  useLocale();
  const id = useId();
  const hintId = useId();
  const { timeZone } = useSettings();
  const { change } = useChangeSettings();
  const isOnline = useIsOnline();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{m.settings_time_zone()}</Label>
      <select
        id={id}
        value={timeZone.chosen}
        disabled={!isOnline}
        aria-describedby={hintId}
        onChange={(event) => change({ timeZone: event.target.value }, m.settings_time_zone)}
        className={selectClass}
      >
        {timeZones(timeZone.chosen).map((zone) => (
          <option key={zone} value={zone}>
            {zone.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
      <p id={hintId} className="text-sm text-muted-foreground">
        {m.settings_applies_tomorrow()}
      </p>
    </div>
  );
}

export const THEMES = ['system', 'light', 'dark'] as const satisfies readonly ThemePreference[];

export const THEME_LABELS: Record<ThemePreference, () => string> = {
  system: m.theme_system,
  light: m.theme_light,
  dark: m.theme_dark,
};

/** The theme of this device (ST-52): saved on it alone, “Undo” as for the others. */
export function ThemeSetting() {
  useLocale();
  const hintId = useId();
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl
      value={preference}
      aria-describedby={hintId}
      onChange={(value) => {
        const chosen = THEMES.find((theme) => theme === value);
        if (!chosen) return;
        const previous = preference;
        setPreference(chosen);
        notify({
          message: m.settings_saved({ setting: m.settings_theme() }),
          undo: async () => setPreference(previous),
        });
      }}
    >
      <Label>{m.settings_theme()}</Label>
      <SegmentedControlItems>
        {THEMES.map((theme) => (
          <SegmentedControlItem key={theme} value={theme}>
            {THEME_LABELS[theme]()}
          </SegmentedControlItem>
        ))}
      </SegmentedControlItems>
      <p id={hintId} className="text-sm text-muted-foreground">
        {m.settings_theme_hint()}
      </p>
    </SegmentedControl>
  );
}

/** “Celebrate the goal reached” (ST-53): nothing to celebrate without an Activity goal. */
export function CelebrateSetting() {
  useLocale();
  const { activityGoal, celebrateGoal } = useSettings();
  const { change } = useChangeSettings();
  const isGoalOff = activityGoal.chosen === null;
  return (
    <ToggleSetting
      label={m.settings_celebrate_goal()}
      hint={isGoalOff ? m.settings_celebrate_goal_off() : undefined}
      isSelected={celebrateGoal}
      isDisabled={isGoalOff}
      onChange={(isSelected) => change({ celebrateGoal: isSelected }, m.settings_celebrate_goal)}
    />
  );
}

/** Language, time zone, theme and shortcuts (spec UX §5.8). */
export function PreferencesSettings() {
  useLocale();
  const { singleKeyShortcuts } = useSettings();
  const { change } = useChangeSettings();
  return (
    <div className="flex flex-col gap-6">
      <LanguageSetting />
      <TimeZoneSetting />
      <ThemeSetting />
      <ToggleSetting
        label={m.settings_single_key_shortcuts()}
        hint={m.settings_single_key_shortcuts_hint()}
        isSelected={singleKeyShortcuts}
        onChange={(isSelected) =>
          change({ singleKeyShortcuts: isSelected }, m.settings_single_key_shortcuts)
        }
      />
      {/* No setting of its own (ST-56): the system's. */}
      <p className="text-sm text-muted-foreground">{m.settings_reduced_motion()}</p>
    </div>
  );
}
