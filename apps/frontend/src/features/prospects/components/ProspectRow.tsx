import type { ProspectType } from '@battlecrm/shared'
import { useTranslation } from 'react-i18next'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { cn } from '@/lib/utils'
import { ProspectDetail } from './ProspectDetail'

interface ProspectRowProps {
  prospect: ProspectType
  stageName: string | undefined
}

export function ProspectRow({ prospect, stageName }: ProspectRowProps) {
  const { t } = useTranslation()
  const isArchived = prospect.deletedAt !== null

  return (
    <AccordionItem value={prospect.id}>
      <AccordionTrigger
        className={cn(
          'items-center px-4 py-3 hover:bg-accent hover:no-underline',
          isArchived && 'opacity-60',
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-medium',
            isArchived && 'line-through text-muted-foreground',
          )}
        >
          {prospect.name}
        </span>
        <span className="w-40 shrink-0 truncate text-sm text-muted-foreground">
          {prospect.company ?? '—'}
        </span>
        <span className="w-40 shrink-0 truncate text-sm">
          {isArchived ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {t('prospects.archived')}
            </span>
          ) : (
            (stageName ?? '—')
          )}
        </span>
        <span className="w-48 shrink-0 truncate text-sm text-muted-foreground">
          {prospect.email ?? '—'}
        </span>
      </AccordionTrigger>

      <AccordionContent className="p-0">
        <div className="border-t bg-muted/30">
          <ProspectDetail prospect={prospect} />
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
