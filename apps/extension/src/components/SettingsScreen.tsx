import { ArrowLeft, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getStorage, setStorage } from '../lib/storage'
import LanguageSelector from './LanguageSelector'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Separator } from './ui/separator'

interface SettingsScreenProps {
  email: string
  onBack: () => void
  onLogout: () => Promise<void>
}

export default function SettingsScreen({ email, onBack, onLogout }: SettingsScreenProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [frontendUrl, setFrontendUrl] = useState('')
  const [frontendUrlSaved, setFrontendUrlSaved] = useState(false)

  useEffect(() => {
    getStorage().then(({ frontendUrl: saved }) => {
      setFrontendUrl(saved ?? '')
    })
  }, [])

  async function handleLogout() {
    setLoading(true)
    try {
      await onLogout()
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveFrontendUrl() {
    await setStorage({ frontendUrl: frontendUrl.trim() || undefined })
    setFrontendUrlSaved(true)
    setTimeout(() => setFrontendUrlSaved(false), 2000)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 px-3 py-2.5">
        <Button
          aria-label={t('settings.back')}
          onClick={onBack}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold">{t('settings.title')}</span>
      </header>

      <Separator />

      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">{t('settings.connectedAs')}</p>
          <p className="text-sm font-medium">{email}</p>
        </div>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="frontendUrl">{t('settings.frontendUrl.label')}</Label>
          <p className="text-xs text-muted-foreground">{t('settings.frontendUrl.hint')}</p>
          <div className="flex gap-2">
            <Input
              id="frontendUrl"
              onChange={(e) => setFrontendUrl(e.target.value)}
              placeholder={t('settings.frontendUrl.placeholder')}
              type="text"
              value={frontendUrl}
            />
            <Button onClick={handleSaveFrontendUrl} size="sm" type="button" variant="outline">
              {frontendUrlSaved ? '✓' : t('settings.frontendUrl.save')}
            </Button>
          </div>
        </div>

        <Separator />

        <LanguageSelector />

        <Separator />

        <Button
          className="w-full"
          disabled={loading}
          onClick={handleLogout}
          type="button"
          variant="destructive"
        >
          <LogOut className="size-4" />
          {loading ? t('settings.loggingOut') : t('settings.logout')}
        </Button>
      </main>
    </div>
  )
}
