import type { PositioningType } from '@battlecrm/shared'
import { useTranslation } from 'react-i18next'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { usePositioningProspects } from '../hooks/usePositioningProspects'

interface PositioningRowProps {
  positioning: PositioningType
}

export function PositioningRow({ positioning }: PositioningRowProps) {
  const { t } = useTranslation()
  const { data: prospectsData, isLoading: prospectsLoading } = usePositioningProspects(
    positioning.id,
  )
  const linkedProspects = prospectsData?.data ?? []

  return (
    <AccordionItem value={positioning.id}>
      <AccordionTrigger className="items-center px-4 py-3 hover:bg-accent hover:no-underline">
        <span className="min-w-0 flex-1 truncate font-medium">{positioning.name}</span>
        <span className="w-40 shrink-0">
          <Badge variant="secondary">{positioning.funnelStageName}</Badge>
        </span>
        <span className="w-64 shrink-0 truncate text-sm text-muted-foreground">
          {positioning.description ?? '—'}
        </span>
      </AccordionTrigger>

      <AccordionContent className="p-0">
        <div className="space-y-4 border-t bg-muted/30 px-4 py-4">
          {/* Details */}
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('positionings.fields.funnelStage')}</dt>
            <dd>
              <Badge variant="secondary">{positioning.funnelStageName}</Badge>
            </dd>

            <dt className="text-muted-foreground">{t('positionings.fields.description')}</dt>
            <dd className="whitespace-pre-wrap">
              {positioning.description ?? <span className="italic text-muted-foreground">—</span>}
            </dd>

            <dt className="text-muted-foreground">{t('positionings.fields.content')}</dt>
            <dd className="whitespace-pre-wrap">
              {positioning.content ?? <span className="italic text-muted-foreground">—</span>}
            </dd>
          </dl>

          {/* Linked prospects */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t('positionings.linkedProspects.title')}
            </p>
            {prospectsLoading ? (
              <p className="text-xs italic text-muted-foreground">...</p>
            ) : linkedProspects.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                {t('positionings.linkedProspects.empty')}
              </p>
            ) : (
              <ul className="space-y-1">
                {linkedProspects.map((prospect) => (
                  <li key={prospect.id} className="text-sm">
                    <span className="font-medium">{prospect.name}</span>
                    {prospect.company && (
                      <span className="ml-2 text-muted-foreground">— {prospect.company}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Interactions — placeholder for Epic 5 */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {t('positionings.interactions.title')}
            </p>
            <p className="text-xs italic text-muted-foreground">
              {t('positionings.interactions.comingSoon')}
            </p>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
