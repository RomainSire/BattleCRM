import type { ProspectType } from '@battlecrm/shared'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AddInteractionDialog } from '@/features/interactions/components/AddInteractionDialog'
import { cn } from '@/lib/utils'

interface ProspectRowProps {
  prospect: ProspectType
  stageName: string | undefined
  onOpenDetail: (prospect: ProspectType) => void
}

export function ProspectRow({ prospect, stageName, onOpenDetail }: ProspectRowProps) {
  const { t } = useTranslation()
  const isArchived = prospect.deletedAt !== null

  return (
    <TableRow
      onClick={() => onOpenDetail(prospect)}
      className={cn('cursor-pointer', isArchived && 'opacity-60')}
    >
      <TableCell className={cn('font-medium', isArchived && 'line-through text-muted-foreground')}>
        {prospect.name}
      </TableCell>

      <TableCell className="text-muted-foreground">{prospect.company ?? '—'}</TableCell>

      <TableCell>
        {isArchived ? (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {t('prospects.archived')}
          </span>
        ) : (
          (stageName ?? '—')
        )}
      </TableCell>

      <TableCell className="text-muted-foreground">{prospect.email ?? '—'}</TableCell>

      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
        {!isArchived && (
          <TooltipProvider>
            <Tooltip>
              <AddInteractionDialog
                initialProspectId={prospect.id}
                trigger={
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label={t('interactions.addInteraction')}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                }
              />
              <TooltipContent>{t('interactions.addInteraction')}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </TableCell>
    </TableRow>
  )
}
