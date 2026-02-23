import { useTranslation } from 'react-i18next'
import { FunnelStageList } from './components/FunnelStageList'

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.description')}</p>
      </header>

      <section>
        <h2 className="mb-3 text-xl font-semibold">{t('settings.funnelConfig.title')}</h2>
        <div className="max-w-md">
          <FunnelStageList />
        </div>
      </section>
    </div>
  )
}
