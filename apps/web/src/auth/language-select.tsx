import { m } from '@battlecrm/i18n';
import { useId } from 'react';

import { changeLocale, locales, useLocale, type Locale } from '../i18n.ts';

// Each language is named in itself, whatever the current one.
const names: Record<Locale, string> = { fr: 'Français', en: 'English' };

/** The discreet language selector of every authentication screen (spec UX §5.9). */
export function LanguageSelect() {
  const locale = useLocale();
  const id = useId();
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <label htmlFor={id}>{m.language()}</label>
      <select
        id={id}
        value={locale}
        onChange={(event) => {
          const chosen = locales.find((candidate) => candidate === event.target.value);
          if (chosen) void changeLocale(chosen);
        }}
        className="h-7 rounded-control border border-input bg-background px-1.5 text-foreground focus-ring"
      >
        {locales.map((candidate) => (
          <option key={candidate} value={candidate} lang={candidate}>
            {names[candidate]}
          </option>
        ))}
      </select>
    </div>
  );
}
