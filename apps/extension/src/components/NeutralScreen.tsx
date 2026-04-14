import { useTranslation } from 'react-i18next'

interface NeutralScreenProps {
  email: string
  baseUrl: string
  onSettingsClick: () => void
}

export default function NeutralScreen({ email, baseUrl, onSettingsClick }: NeutralScreenProps) {
  const { t } = useTranslation()

  async function openApp() {
    await browser.tabs.create({ url: baseUrl })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <span className="text-sm font-bold text-gray-900">⚔️ BattleCRM</span>
        <button
          aria-label={t('aria.settings')}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          onClick={onSettingsClick}
          type="button"
        >
          ⚙️
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-6 text-center">
        <p className="text-sm text-gray-600">{t('neutral.linkedinHint')}</p>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={openApp}
          type="button"
        >
          {t('neutral.openApp')}
        </button>
      </main>

      <footer className="border-t border-gray-200 px-4 py-2">
        <p className="text-xs text-gray-400">{t('neutral.connected', { email })}</p>
      </footer>
    </div>
  )
}
