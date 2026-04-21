import { ExternalLink, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Separator } from './ui/separator'

interface NeutralScreenProps {
  email: string
  baseUrl: string
  onSettingsClick: () => void
}

export default function NeutralScreen({ email, baseUrl, onSettingsClick }: NeutralScreenProps) {
  const { t } = useTranslation()

  async function openApp() {
    await browser.tabs.create({ url: baseUrl })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <img alt="BattleCRM" className="h-6 w-auto" src="/BattleCRM_logo.svg" />
          <span className="font-bold text-2xl text-brand-gradient">{t('common.appName')}</span>
        </div>
        <Button
          aria-label={t('aria.settings')}
          onClick={onSettingsClick}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Settings className="size-4" />
        </Button>
      </header>

      <Separator />

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-6 text-center">
        <p className="text-sm text-muted-foreground">{t('neutral.linkedinHint')}</p>
        <Button onClick={openApp} type="button">
          <ExternalLink className="size-4" />
          {t('neutral.openApp')}
        </Button>
      </main>

      <Separator />

      <footer className="px-4 py-2.5">
        <p className="text-xs text-muted-foreground">{t('neutral.connected', { email })}</p>
      </footer>
    </div>
  )
}
