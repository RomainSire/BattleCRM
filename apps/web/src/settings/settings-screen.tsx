import { m } from '@battlecrm/i18n';
import type { ReactNode } from 'react';

import { useLocale } from '../i18n.ts';
import { Screen } from '../screens/screen.tsx';
import { useIsNarrow } from '../use-narrow.ts';
import { ChangeEmail } from './change-email.tsx';
import { ChangePassword } from './change-password.tsx';
import { ConnectedDevices } from './connected-devices.tsx';
import {
  CelebrateSetting,
  LanguageSetting,
  PreferencesSettings,
  ThemeSetting,
} from './preferences-settings.tsx';
import { ProspectingSettings } from './prospecting-settings.tsx';
import { TwoFactor } from './two-factor.tsx';

const cardClass = 'rounded-card border p-4';

/** The sections, each reachable by its anchor; the Funnel joins them with its ticket (35). */
const SECTIONS = [
  { id: 'prospecting', title: m.settings_prospecting },
  { id: 'preferences', title: m.settings_preferences },
  { id: 'account', title: m.settings_account },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const title = SECTIONS.find((section) => section.id === id)?.title;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-4 flex-col gap-4">
      <h2 id={`${id}-title`} className="text-base font-semibold">
        {title?.()}
      </h2>
      {children}
    </section>
  );
}

/**
 * Settings (spec UX §5.8): a column of anchors, then a section each, saved field by field. On a
 * narrow width, only the simple ones: language, theme, celebration, Account (spec UX §3.2).
 */
export function SettingsScreen() {
  useLocale();
  const isNarrow = useIsNarrow();
  return (
    <Screen title={m.settings()}>
      <div className="flex gap-8">
        {!isNarrow && (
          <nav aria-label={m.settings_sections()} className="sticky top-5 h-fit w-40 shrink-0">
            <ul className="flex flex-col gap-1 text-sm">
              {SECTIONS.map(({ id, title }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="block rounded-control px-2 py-1 text-muted-foreground focus-ring hover:text-foreground"
                  >
                    {title()}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div className="flex max-w-xl min-w-0 flex-1 flex-col gap-8">
          {isNarrow ? (
            <Section id="preferences">
              <div className={`${cardClass} flex flex-col gap-6`}>
                <LanguageSetting />
                <ThemeSetting />
                <CelebrateSetting />
              </div>
            </Section>
          ) : (
            <>
              <Section id="prospecting">
                <div className={cardClass}>
                  <ProspectingSettings />
                </div>
              </Section>
              <Section id="preferences">
                <div className={cardClass}>
                  <PreferencesSettings />
                </div>
              </Section>
            </>
          )}
          <Section id="account">
            {/* One card per subject: a thin rule, no shadow (spec UX §2). */}
            <div className={cardClass}>
              <ChangeEmail />
            </div>
            <div className={cardClass}>
              <ChangePassword />
            </div>
            <div className={cardClass}>
              <TwoFactor />
            </div>
            <div className={cardClass}>
              <ConnectedDevices />
            </div>
          </Section>
        </div>
      </div>
    </Screen>
  );
}
