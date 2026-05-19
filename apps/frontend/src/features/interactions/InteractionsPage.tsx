import type { InteractionType } from '@battlecrm/shared'
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
import { AddInteractionDialog } from './components/AddInteractionDialog'
import { InteractionDetail } from './components/InteractionDetail'
import { InteractionsList } from './components/InteractionsList'
import { useInteraction } from './hooks/useInteraction'

export function InteractionsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cachedInteraction, setCachedInteraction] = useState<InteractionType | null>(null)

  const selectedInteractionId = searchParams.get('interaction')

  const { data: freshInteraction, isLoading: interactionLoading } = useInteraction(
    selectedInteractionId ?? '',
    { enabled: !!selectedInteractionId },
  )

  const selectedInteraction = freshInteraction ?? cachedInteraction

  function openDetail(interaction: InteractionType) {
    setCachedInteraction(interaction)
    setSearchParams({ interaction: interaction.id })
  }

  function closeDetail() {
    setCachedInteraction(null)
    setSearchParams({}, { replace: true })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('interactions.title')}</h1>
          <p className="text-muted-foreground">{t('interactions.description')}</p>
        </div>
        <AddInteractionDialog />
      </header>
      <section>
        <InteractionsList onOpenDetail={openDetail} />
      </section>

      <Drawer
        direction="right"
        open={!!selectedInteractionId}
        onOpenChange={(open) => !open && closeDetail()}
      >
        <DrawerContent className="w-180 max-w-[100vw] overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{selectedInteraction?.prospectName ?? ''}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {t('interactions.drawerDescription')}
            </DrawerDescription>
          </DrawerHeader>
          {selectedInteraction ? (
            <InteractionDetail
              key={selectedInteractionId}
              interaction={selectedInteraction}
              onClose={closeDetail}
            />
          ) : interactionLoading ? (
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
