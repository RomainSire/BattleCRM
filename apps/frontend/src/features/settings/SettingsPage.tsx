import { Moon, Sun, SunMoon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { setTheme, useTheme } from '@/lib/theme'
import { BackupSection } from './components/BackupSection'
import { ChangePasswordDialog } from './components/ChangePasswordDialog'
import { FunnelStageList } from './components/FunnelStageList'

export function SettingsPage() {
  const { t } = useTranslation()
  const { theme } = useTheme()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.description')}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.preferences.title')}</CardTitle>
          <CardDescription>{t('settings.preferences.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">{t('settings.appearance.title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('settings.appearance.description')}
              </p>
            </div>
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
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">{t('settings.language.title')}</p>
              <p className="text-sm text-muted-foreground">{t('settings.language.description')}</p>
            </div>
            <LanguageToggle />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.pipeline.title')}</CardTitle>
          <CardDescription>{t('settings.pipeline.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <FunnelStageList />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.account.title')}</CardTitle>
          <CardDescription>{t('settings.account.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordDialog />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.backup.title')}</CardTitle>
          <CardDescription>{t('settings.backup.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <BackupSection />
        </CardContent>
      </Card>
    </div>
  )
}
