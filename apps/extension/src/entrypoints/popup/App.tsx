import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../../assets/tailwind.css'
import AuthForm from '../../components/AuthForm'
import NeutralScreen from '../../components/NeutralScreen'
import ProspectPopupScreen from '../../components/ProspectPopupScreen'
import SettingsScreen from '../../components/SettingsScreen'
import { isProfilePage, normalizeLinkedInUrl } from '../../lib/linkedin'
import { clearAuth, getStorage } from '../../lib/storage'

type Screen = 'loading' | 'login' | 'neutral' | 'settings' | 'prospect'

export default function App() {
  const { t } = useTranslation()
  const [screen, setScreen] = useState<Screen>('loading')
  const [email, setEmail] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | undefined>(undefined)

  useEffect(() => {
    getStorage().then(({ token, email: storedEmail, baseUrl: storedBaseUrl }) => {
      if (token && storedEmail && storedBaseUrl) {
        setEmail(storedEmail)
        setBaseUrl(storedBaseUrl)
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
          const tabUrl = tabs[0]?.url
          if (tabUrl && isProfilePage(tabUrl)) {
            setLinkedinUrl(normalizeLinkedInUrl(tabUrl))
            setScreen('prospect')
          } else {
            setScreen('neutral')
          }
        })
      } else {
        setScreen('login')
      }
    })
  }, [])

  useEffect(() => {
    function handleMessage(message: { type: string }) {
      if (message.type === 'AUTH_EXPIRED') {
        setSessionExpiredMessage(t('session.expired'))
        setScreen('login')
      }
    }
    browser.runtime.onMessage.addListener(handleMessage)
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage)
    }
  }, [t])

  function handleAuthSuccess(loggedInEmail: string) {
    setEmail(loggedInEmail)
    setSessionExpiredMessage(undefined)
    setScreen('neutral')
  }

  async function handleLogout() {
    try {
      await browser.runtime.sendMessage({ type: 'LOGOUT' })
    } catch {
      await clearAuth()
    }
    setEmail('')
    setBaseUrl('')
    setLinkedinUrl('')
    setScreen('login')
  }

  if (screen === 'loading') {
    return <div className="w-72 py-8" />
  }

  if (screen === 'login') {
    return (
      <div className="min-h-48 w-72">
        <AuthForm initialError={sessionExpiredMessage} onSuccess={handleAuthSuccess} />
      </div>
    )
  }

  if (screen === 'settings') {
    return (
      <div className="min-h-48 w-72">
        <SettingsScreen email={email} onBack={() => setScreen('neutral')} onLogout={handleLogout} />
      </div>
    )
  }

  if (screen === 'prospect' && linkedinUrl) {
    return (
      <div className="w-72">
        <ProspectPopupScreen
          baseUrl={baseUrl}
          linkedinUrl={linkedinUrl}
          onSettingsClick={() => setScreen('settings')}
        />
      </div>
    )
  }

  return (
    <div className="min-h-48 w-72">
      <NeutralScreen
        email={email}
        onSettingsClick={() => setScreen('settings')}
      />
    </div>
  )
}
