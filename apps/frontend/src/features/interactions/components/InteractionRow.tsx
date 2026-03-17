import type { InteractionType } from '@battlecrm/shared'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { StatusIcon } from './StatusIcon'

interface InteractionRowProps {
  interaction: InteractionType
  isExpanded: boolean
  onToggle: () => void
}

export function InteractionRow({ interaction, isExpanded, onToggle }: InteractionRowProps) {
  const { t } = useTranslation()

  const notesPreview = interaction.notes
    ? interaction.notes.length > 80
      ? `${interaction.notes.slice(0, 80)}…`
      : interaction.notes
    : '—'

  return (
    <>
      <TableRow onClick={onToggle} className="cursor-pointer" aria-expanded={isExpanded}>
        <TableCell className="w-8 pr-0">
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-180',
            )}
          />
        </TableCell>

        <TableCell className="text-sm text-muted-foreground">
          {new Date(interaction.interactionDate).toLocaleDateString()}
        </TableCell>

        <TableCell className="font-medium">{interaction.prospectName}</TableCell>

        <TableCell>
          <Badge variant="outline">{interaction.prospectFunnelStageName}</Badge>
        </TableCell>

        <TableCell>
          <StatusIcon status={interaction.status} className="size-4" />
        </TableCell>

        <TableCell className="text-sm text-muted-foreground">{notesPreview}</TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="p-0">
            <div className="bg-muted/30 px-4 py-3 space-y-2 text-sm">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <span className="text-muted-foreground">{t('interactions.detail.date')}</span>
                <span>{new Date(interaction.interactionDate).toLocaleString()}</span>

                <span className="text-muted-foreground">{t('interactions.fields.status')}</span>
                <StatusIcon status={interaction.status} className="size-4" withLabel />

                <span className="text-muted-foreground">
                  {t('interactions.detail.positioning')}
                </span>
                <span>{interaction.positioningName ?? t('interactions.noPositioning')}</span>

                <span className="text-muted-foreground">{t('prospects.title')}</span>
                <span>{interaction.prospectName}</span>
              </div>

              {interaction.notes && (
                <div className="pt-1">
                  <p className="text-muted-foreground text-xs mb-1">
                    {t('interactions.fields.notes')}
                  </p>
                  <p className="whitespace-pre-wrap">{interaction.notes}</p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
