import { Moon, Sun, SunMoon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { setTheme, useTheme } from '@/lib/theme'
import { FunnelStageList } from './components/FunnelStageList'

export function SettingsPage() {
  const { t, i18n } = useTranslation()
  const { theme } = useTheme()

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.description')}</p>
      </header>

      <section>
        <h2 className="mb-1 text-xl font-semibold">{t('settings.appearance.title')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t('settings.appearance.description')}</p>
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={(v) => v && setTheme(v as 'light' | 'dark' | 'system')}
        >
          <ToggleGroupItem value="system" className="gap-2">
            <SunMoon className="size-4" />
            {t('settings.appearance.themes.system')}
          </ToggleGroupItem>
          <ToggleGroupItem value="light" className="gap-2">
            <Sun className="size-4" />
            {t('settings.appearance.themes.light')}
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" className="gap-2">
            <Moon className="size-4" />
            {t('settings.appearance.themes.dark')}
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold">{t('settings.language.title')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t('settings.language.description')}</p>
        <ToggleGroup
          type="single"
          value={i18n.language}
          onValueChange={(v) => v && i18n.changeLanguage(v)}
        >
          <ToggleGroupItem value="fr">Français</ToggleGroupItem>
          <ToggleGroupItem value="en">English</ToggleGroupItem>
        </ToggleGroup>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{t('settings.funnelConfig.title')}</h2>
        <div className="max-w-md">
          <FunnelStageList />
        </div>
      </section>
    </div>
  )
}
