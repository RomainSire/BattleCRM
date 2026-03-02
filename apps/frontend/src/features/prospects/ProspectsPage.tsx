import { LayoutGrid, List } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AddProspectDialog } from './components/AddProspectDialog'
import { ProspectsList } from './components/ProspectsList'

export function ProspectsPage() {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('prospects.title')}</h1>
          <p className="text-muted-foreground">{t('prospects.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as 'list' | 'kanban')}
            aria-label={t('prospects.viewToggle.label')}
          >
            <ToggleGroupItem value="list" aria-label={t('prospects.viewToggle.list')}>
              <List className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label={t('prospects.viewToggle.kanban')}>
              <LayoutGrid className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <AddProspectDialog />
        </div>
      </header>

      <section>
        {viewMode === 'list' ? (
          <ProspectsList />
        ) : (
          <p className="text-sm italic text-muted-foreground">
            {t('prospects.viewToggle.kanbanPlaceholder')}
          </p>
        )}
      </section>
    </div>
  )
}
