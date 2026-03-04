import { LayoutGrid, List } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AddProspectDialog } from './components/AddProspectDialog'
import { ProspectsKanbanView } from './components/ProspectsKanbanView'
import { ProspectsList } from './components/ProspectsList'

const PROSPECTS_VIEW_KEY = 'prospects-view-mode'

export function ProspectsPage() {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(
    localStorage.getItem(PROSPECTS_VIEW_KEY) === 'kanban' ? 'kanban' : 'list',
  )

  function handleViewChange(v: string) {
    if (!v) return
    const mode = v as 'list' | 'kanban'
    localStorage.setItem(PROSPECTS_VIEW_KEY, mode)
    setViewMode(mode)
  }

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
            onValueChange={handleViewChange}
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

      <section>{viewMode === 'list' ? <ProspectsList /> : <ProspectsKanbanView />}</section>
    </div>
  )
}
