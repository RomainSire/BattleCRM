import type { PositioningType } from '@battlecrm/shared'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface PositioningRowProps {
  positioning: PositioningType
  onOpenDetail: (positioning: PositioningType) => void
}

export function PositioningRow({ positioning, onOpenDetail }: PositioningRowProps) {
  const { t } = useTranslation()
  const isArchived = positioning.deletedAt !== null

  return (
    <TableRow
      onClick={() => onOpenDetail(positioning)}
      className={cn('cursor-pointer', isArchived && 'opacity-60')}
    >
      <TableCell className={cn('font-medium', isArchived && 'line-through text-muted-foreground')}>
        {positioning.name}
      </TableCell>

      <TableCell className="w-40">
        {isArchived ? (
          <Badge variant="outline" className="text-muted-foreground">
            {t('positionings.archivedBadge')}
          </Badge>
        ) : (
          <Badge variant="secondary">{positioning.funnelStageName}</Badge>
        )}
      </TableCell>

      <TableCell className="w-64 max-w-64 truncate text-sm text-muted-foreground">
        {positioning.description ?? '—'}
      </TableCell>
    </TableRow>
  )
}
