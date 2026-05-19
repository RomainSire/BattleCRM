import type { PositioningType } from '@battlecrm/shared'
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
import { AddPositioningDialog } from './components/AddPositioningDialog'
import { PositioningDetail } from './components/PositioningDetail'
import { PositioningsList } from './components/PositioningsList'
import { usePositioning } from './hooks/usePositioning'

export function PositioningsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cachedPositioning, setCachedPositioning] = useState<PositioningType | null>(null)

  const selectedPositioningId = searchParams.get('positioning')

  const { data: freshPositioning, isLoading: positioningLoading } = usePositioning(
    selectedPositioningId ?? '',
    { enabled: !!selectedPositioningId },
  )

  const selectedPositioning = freshPositioning ?? cachedPositioning

  function openDetail(positioning: PositioningType) {
    setCachedPositioning(positioning)
    setSearchParams({ positioning: positioning.id })
  }

  function closeDetail() {
    setCachedPositioning(null)
    setSearchParams({}, { replace: true })
  }

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
        <PositioningsList onOpenDetail={openDetail} />
      </section>

      <Drawer
        direction="right"
        open={!!selectedPositioningId}
        onOpenChange={(open) => !open && closeDetail()}
      >
        <DrawerContent className="w-180 max-w-[100vw] overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{selectedPositioning?.name ?? ''}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {t('positionings.drawerDescription')}
            </DrawerDescription>
          </DrawerHeader>
          {selectedPositioning ? (
            <PositioningDetail
              key={selectedPositioningId}
              positioning={selectedPositioning}
              onClose={closeDetail}
            />
          ) : positioningLoading ? (
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
