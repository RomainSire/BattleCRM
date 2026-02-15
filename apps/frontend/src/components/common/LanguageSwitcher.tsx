import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const nextLang = i18n.language === 'fr' ? 'en' : 'fr'
  const label = i18n.language === 'fr' ? 'EN' : 'FR'

  return (
    <Button variant="ghost" size="sm" onClick={() => i18n.changeLanguage(nextLang)}>
      {label}
    </Button>
  )
}
