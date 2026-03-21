import { useTranslation } from 'react-i18next'
import { AddPositioningDialog } from './components/AddPositioningDialog'
import { PositioningsList } from './components/PositioningsList'

export function PositioningsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('positionings.title')}</h1>
          <p className="text-muted-foreground">{t('positionings.description')}</p>
        </div>
        <AddPositioningDialog />
      </header>

      <section>
        <PositioningsList />
      </section>
    </div>
  )
}
