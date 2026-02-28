import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProspectType } from '../lib/api'

interface ProspectRowProps {
  prospect: ProspectType
  stageName: string | undefined
  isExpanded: boolean
  onToggle: () => void
}

export function ProspectRow({ prospect, stageName, isExpanded, onToggle }: ProspectRowProps) {
  const { t } = useTranslation()

  return (
    <article className="border-b last:border-b-0">
      {/* Collapsed row — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-accent"
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{prospect.name}</span>
        <span className="w-40 shrink-0 truncate text-sm text-muted-foreground">
          {prospect.company ?? '—'}
        </span>
        <span className="w-40 shrink-0 truncate text-sm">{stageName ?? '—'}</span>
        <span className="w-48 shrink-0 truncate text-sm text-muted-foreground">
          {prospect.email ?? '—'}
        </span>
      </button>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="space-y-2 border-t bg-muted/30 px-4 py-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {prospect.company && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.company')}</dt>
                <dd>{prospect.company}</dd>
              </>
            )}
            {prospect.linkedinUrl && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.linkedinUrl')}</dt>
                <dd>
                  <a
                    href={prospect.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-primary underline-offset-4 hover:underline"
                  >
                    {prospect.linkedinUrl}
                  </a>
                </dd>
              </>
            )}
            {prospect.email && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.email')}</dt>
                <dd>{prospect.email}</dd>
              </>
            )}
            {prospect.phone && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.phone')}</dt>
                <dd>{prospect.phone}</dd>
              </>
            )}
            {prospect.title && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.title')}</dt>
                <dd>{prospect.title}</dd>
              </>
            )}
            {prospect.notes && (
              <>
                <dt className="text-muted-foreground">{t('prospects.fields.notes')}</dt>
                <dd className="whitespace-pre-wrap">{prospect.notes}</dd>
              </>
            )}
          </dl>
          {/* Interactions — Epic 5 */}
          <p className="mt-4 text-xs italic text-muted-foreground">
            {t('prospects.interactionsComingSoon')}
          </p>
        </div>
      )}
    </article>
  )
}
