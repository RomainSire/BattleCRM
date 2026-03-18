import { useTranslation } from 'react-i18next'
import { AddInteractionDialog } from './components/AddInteractionDialog'
import { InteractionsList } from './components/InteractionsList'

export function InteractionsPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('interactions.title')}</h1>
        </div>
        <AddInteractionDialog />
      </header>
      <section>
        <InteractionsList />
      </section>
    </div>
  )
}
