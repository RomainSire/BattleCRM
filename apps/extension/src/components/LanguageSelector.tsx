import { useTranslation } from 'react-i18next'
import { cn } from '../lib/utils'

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
] as const

export default function LanguageSelector() {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{t('settings.language.label')}</span>
      <div className="flex overflow-hidden rounded-md border border-border text-xs font-medium">
        {LANGUAGES.map(({ code, label }, index) => (
          <button
            className={cn(
              'px-3 py-1.5 transition-colors',
              index > 0 && 'border-l border-border',
              current === code
                ? 'bg-brand-gradient text-white'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
            key={code}
            onClick={() => i18n.changeLanguage(code)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
