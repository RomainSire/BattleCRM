import type { ProspectType } from '@battlecrm/shared'
import { LayoutGrid, List } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AddProspectDialog } from './components/AddProspectDialog'
import { ProspectDetail } from './components/ProspectDetail'
import { ProspectsKanbanView } from './components/ProspectsKanbanView'
import { ProspectsList } from './components/ProspectsList'
import { useProspect } from './hooks/useProspect'

const PROSPECTS_VIEW_KEY = 'prospects-view-mode'

export function ProspectsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>(
    localStorage.getItem(PROSPECTS_VIEW_KEY) === 'kanban' ? 'kanban' : 'list',
  )
  // Cached on click so the drawer opens immediately with full content.
  // useProspect fetches fresh data in the background and replaces it silently.
  const [cachedProspect, setCachedProspect] = useState<ProspectType | null>(null)

  const selectedProspectId = searchParams.get('prospect')

  const { data: freshProspect, isLoading: prospectLoading } = useProspect(
    selectedProspectId ?? '',
    { enabled: !!selectedProspectId },
  )

  // Fresh API data takes precedence; fall back to cached click data while loading
  const selectedProspect = freshProspect ?? cachedProspect

  function handleViewChange(v: string) {
    if (!v) return
    const mode = v as 'list' | 'kanban'
    localStorage.setItem(PROSPECTS_VIEW_KEY, mode)
    setViewMode(mode)
  }

  function openDetail(prospect: ProspectType) {
    setCachedProspect(prospect)
    setSearchParams({ prospect: prospect.id })
  }

  function closeDetail() {
    setCachedProspect(null)
    setSearchParams({}, { replace: true })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('prospects.title')}</h1>
          <p className="text-muted-foreground">{t('prospects.description')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={handleViewChange}
            aria-label={t('prospects.viewToggle.label')}
          >
            <ToggleGroupItem value="list" className="gap-2">
              <List className="size-4" />
              {t('prospects.viewToggle.list')}
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" className="gap-2">
              <LayoutGrid className="size-4" />
              {t('prospects.viewToggle.kanban')}
            </ToggleGroupItem>
          </ToggleGroup>
          <AddProspectDialog />
        </div>
      </header>

      <section>
        {viewMode === 'list' ? (
          <ProspectsList onOpenDetail={openDetail} />
        ) : (
          <ProspectsKanbanView onOpenDetail={openDetail} />
        )}
      </section>

      <Drawer
        direction="right"
        open={!!selectedProspectId}
        onOpenChange={(open) => !open && closeDetail()}
      >
        <DrawerContent className="w-180 max-w-[100vw] overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{selectedProspect?.name ?? ''}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {t('prospects.drawerDescription')}
            </DrawerDescription>
          </DrawerHeader>
          {selectedProspect ? (
            <ProspectDetail
              key={selectedProspectId}
              prospect={selectedProspect}
              onClose={closeDetail}
            />
          ) : prospectLoading ? (
            <div className="space-y-3 px-4 py-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
