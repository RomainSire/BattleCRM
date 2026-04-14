import { useState } from 'react'

interface SettingsScreenProps {
  email: string
  onBack: () => void
  onLogout: () => Promise<void>
}

export default function SettingsScreen({ email, onBack, onLogout }: SettingsScreenProps) {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      await onLogout()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-2">
        <button
          aria-label="Retour"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          onClick={onBack}
          type="button"
        >
          ←
        </button>
        <span className="text-sm font-bold text-gray-900">Paramètres</span>
      </header>

      <main className="flex flex-1 flex-col gap-4 px-4 py-6">
        <p className="text-sm text-gray-700">
          Connecté en tant que <span className="font-medium">{email}</span>
        </p>

        <button
          className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          disabled={loading}
          onClick={handleLogout}
          type="button"
        >
          {loading ? 'Déconnexion…' : 'Se déconnecter'}
        </button>
      </main>
    </div>
  )
}
