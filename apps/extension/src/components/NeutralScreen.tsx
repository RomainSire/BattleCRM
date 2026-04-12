interface NeutralScreenProps {
  email: string
  baseUrl: string
  onSettingsClick: () => void
}

export default function NeutralScreen({ email, baseUrl, onSettingsClick }: NeutralScreenProps) {
  async function openApp() {
    await browser.tabs.create({ url: baseUrl })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <span className="text-sm font-bold text-gray-900">⚔️ BattleCRM</span>
        <button
          aria-label="Paramètres"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          onClick={onSettingsClick}
          type="button"
        >
          ⚙️
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-6 text-center">
        <p className="text-sm text-gray-600">
          Naviguez vers un profil LinkedIn pour capturer un prospect.
        </p>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={openApp}
          type="button"
        >
          Ouvrir BattleCRM ↗
        </button>
      </main>

      <footer className="border-t border-gray-200 px-4 py-2">
        <p className="text-xs text-gray-400">Connecté : {email}</p>
      </footer>
    </div>
  )
}
