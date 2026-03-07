import { useTranslation } from 'react-i18next'
import { PositioningsList } from './components/PositioningsList'

export function PositioningsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('positionings.title')}</h1>
        <p className="text-muted-foreground">{t('positionings.description')}</p>
      </header>

      <section>
        <PositioningsList />
      </section>
    </div>
  )
}
