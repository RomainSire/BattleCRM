import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { ProspectType } from '../lib/api'
import { ProspectDetail } from './ProspectDetail'

interface ProspectRowProps {
  prospect: ProspectType
  stageName: string | undefined
  isExpanded: boolean
  onToggle: () => void
}

export function ProspectRow({ prospect, stageName, isExpanded, onToggle }: ProspectRowProps) {
  const { t } = useTranslation()
  const isArchived = prospect.deletedAt !== null

  return (
    <article className="border-b last:border-b-0">
      {/* Collapsed row — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-accent',
          isArchived && 'opacity-60',
        )}
        aria-expanded={isExpanded}
        aria-controls={`prospect-panel-${prospect.id}`}
      >
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition',
            isExpanded ? 'rotate-90' : '',
          )}
          aria-hidden="true"
        />
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
      </button>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div id={`prospect-panel-${prospect.id}`} className="border-t bg-muted/30">
          <ProspectDetail prospect={prospect} />
        </div>
      )}
    </article>
  )
}
