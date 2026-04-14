import { useEffect, useState } from 'react'
import '../../assets/tailwind.css'
import AuthForm from '../../components/AuthForm'
import NeutralScreen from '../../components/NeutralScreen'
import SettingsScreen from '../../components/SettingsScreen'
import { clearAuth, getStorage } from '../../lib/storage'

type Screen = 'loading' | 'login' | 'neutral' | 'settings'

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [email, setEmail] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | undefined>(undefined)

  useEffect(() => {
    getStorage().then(({ token, email: storedEmail, baseUrl: storedBaseUrl }) => {
      if (token && storedEmail && storedBaseUrl) {
        setEmail(storedEmail)
        setBaseUrl(storedBaseUrl)
        setScreen('neutral')
      } else {
        setScreen('login')
      }
    })
  }, [])

  useEffect(() => {
    function handleMessage(message: { type: string }) {
      if (message.type === 'AUTH_EXPIRED') {
        setSessionExpiredMessage('Session expirée, veuillez vous reconnecter')
        setScreen('login')
      }
    }
    browser.runtime.onMessage.addListener(handleMessage)
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage)
    }
  }, [])

  function handleAuthSuccess(loggedInEmail: string) {
    setEmail(loggedInEmail)
    setSessionExpiredMessage(undefined)
    setScreen('neutral')
  }

  async function handleLogout() {
    try {
      await browser.runtime.sendMessage({ type: 'LOGOUT' })
    } catch {
      // Service worker may not be running (MV3 lifecycle) — clear storage directly
      await clearAuth()
    }
    setEmail('')
    setBaseUrl('')
    setScreen('login')
  }

  if (screen === 'loading') {
    return <div className="w-72 py-8" />
  }

  if (screen === 'login') {
    return (
      <div className="w-72 min-h-48">
        <AuthForm initialError={sessionExpiredMessage} onSuccess={handleAuthSuccess} />
      </div>
    )
  }

  if (screen === 'settings') {
    return (
      <div className="w-72 min-h-48">
        <SettingsScreen email={email} onBack={() => setScreen('neutral')} onLogout={handleLogout} />
      </div>
    )
  }

  return (
    <div className="w-72 min-h-48">
      <NeutralScreen
        baseUrl={baseUrl}
        email={email}
        onSettingsClick={() => setScreen('settings')}
      />
    </div>
  )
}
