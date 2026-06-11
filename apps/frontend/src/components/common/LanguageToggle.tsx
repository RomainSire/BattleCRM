import { useTranslation } from 'react-i18next'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/** Supported UI languages. `label` is shown in the full variant, `short` in the compact one. */
const LANGUAGES = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ja', label: '日本語', short: '日本語' },
] as const

type LanguageToggleProps = {
  /** `full` shows language names (e.g. Settings); `compact` shows short codes (e.g. header). */
  variant?: 'full' | 'compact'
  className?: string
}

/**
 * Language selector backed by a shadcn ToggleGroup.
 * Reused in the guest layout header (compact) and the settings page (full).
 */
export function LanguageToggle({ variant = 'full', className }: LanguageToggleProps) {
  const { t, i18n } = useTranslation()

  const current = i18n.resolvedLanguage ?? i18n.language
  const activeCode = LANGUAGES.find((l) => current.startsWith(l.code))?.code ?? 'en'

  return (
    <ToggleGroup
      type="single"
      value={activeCode}
      onValueChange={(value) => value && i18n.changeLanguage(value)}
      variant={variant === 'compact' ? 'outline' : 'default'}
      size={variant === 'compact' ? 'sm' : 'default'}
      className={className}
      aria-label={t('settings.language.title')}
    >
      {LANGUAGES.map((lang) => (
        <ToggleGroupItem key={lang.code} value={lang.code}>
          {variant === 'compact' ? lang.short : lang.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
