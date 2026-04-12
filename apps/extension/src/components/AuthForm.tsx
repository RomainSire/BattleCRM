import { useState } from 'react'
import { loginExtension } from '../lib/api'
import { setStorage } from '../lib/storage'

interface AuthFormProps {
  onSuccess: (email: string) => void
  initialError?: string
}

export default function AuthForm({ onSuccess, initialError }: AuthFormProps) {
  const [baseUrl, setBaseUrl] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)

  const isDisabled = !baseUrl.trim() || !email.trim() || !password.trim() || loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const tokenName = browser.runtime.getManifest().name
      const res = await loginExtension(baseUrl.trim(), email.trim(), password, tokenName)
      await setStorage({ token: res.token, baseUrl: baseUrl.trim(), email: email.trim() })
      onSuccess(email.trim())
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('401')) {
        setError('Identifiants invalides')
      } else {
        setError('Serveur inaccessible')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-center">
        <h1 className="text-base font-bold text-gray-900">⚔️ BattleCRM</h1>
        <p className="mt-0.5 text-xs text-gray-500">Connectez votre instance</p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700" htmlFor="baseUrl">
            URL BattleCRM
          </label>
          <input
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            id="baseUrl"
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:3333"
            type="url"
            value={baseUrl}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700" htmlFor="email">
            Email
          </label>
          <input
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            id="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            type="email"
            value={email}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700" htmlFor="password">
            Mot de passe
          </label>
          <input
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            id="password"
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            value={password}
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          className="mt-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isDisabled}
          type="submit"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
