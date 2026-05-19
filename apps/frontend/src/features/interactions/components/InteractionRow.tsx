import type { InteractionType } from '@battlecrm/shared'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'

interface InteractionRowProps {
  interaction: InteractionType
  onOpenDetail: (interaction: InteractionType) => void
}

export function InteractionRow({ interaction, onOpenDetail }: InteractionRowProps) {
  const notesPreview = interaction.notes
    ? interaction.notes.length > 80
      ? `${interaction.notes.slice(0, 80)}…`
      : interaction.notes
    : '—'

  return (
    <TableRow onClick={() => onOpenDetail(interaction)} className="cursor-pointer">
      <TableCell className="text-sm text-muted-foreground">
        {new Date(interaction.interactionDate).toLocaleDateString()}
      </TableCell>

      <TableCell className="font-medium">{interaction.prospectName}</TableCell>

      <TableCell>
        <Badge variant="outline">{interaction.prospectFunnelStageName}</Badge>
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">{notesPreview}</TableCell>
    </TableRow>
  )
}
