import { useTranslation } from 'react-i18next'
import { AddProspectDialog } from './components/AddProspectDialog'
import { ProspectsList } from './components/ProspectsList'

export function ProspectsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('prospects.title')}</h1>
          <p className="text-muted-foreground">{t('prospects.description')}</p>
        </div>
        <AddProspectDialog />
      </header>

      <section>
        <ProspectsList />
      </section>
    </div>
  )
}
