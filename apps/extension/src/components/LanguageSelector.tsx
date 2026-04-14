import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
] as const

export default function LanguageSelector() {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage ?? i18n.language

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{t('settings.language.label')}</span>
      <div className="flex overflow-hidden rounded border border-gray-200 text-xs font-medium">
        {LANGUAGES.map(({ code, label }, index) => (
          <button
            className={`px-3 py-1 transition-colors ${index > 0 ? 'border-l border-gray-200' : ''} ${
              current === code ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
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
