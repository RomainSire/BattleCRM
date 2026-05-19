import type { ExtensionProspectData } from '@battlecrm/shared'
import { ExternalLink, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getStorage } from '../lib/storage'
import { Button } from './ui/button'
import { Separator } from './ui/separator'

interface ProspectCardProps {
  prospect: ExtensionProspectData
  onEdit: () => void
  successMessage?: string
}

export default function ProspectCard({ prospect, onEdit, successMessage }: ProspectCardProps) {
  const { t } = useTranslation()

  async function handleViewInApp() {
    const { baseUrl, frontendUrl } = await getStorage()
    const appUrl = frontendUrl || baseUrl
    if (!appUrl) return
    browser.tabs.create({ url: `${appUrl}/prospects?prospect=${prospect.id}` })
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="mx-4 mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
        {t('prospect.read.foundBanner')}
      </div>

      {successMessage && (
        <div className="mx-4 mt-2 rounded-md bg-green-100 px-3 py-2 text-xs font-medium text-green-800">
          {successMessage}
        </div>
      )}

      <div className="flex flex-col gap-2 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{prospect.name}</p>
          {prospect.title && <p className="text-xs text-muted-foreground">{prospect.title}</p>}
          {prospect.company && <p className="text-xs text-muted-foreground">{prospect.company}</p>}
        </div>

        <Separator />

        <div className="flex flex-col gap-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('prospect.read.stage')}</span>
            <span className="font-medium">{prospect.funnelStageName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('prospect.read.email')}</span>
            <span className="font-medium">{prospect.email ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('prospect.read.phone')}</span>
            <span className="font-medium">{prospect.phone ?? '—'}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-4 pb-4">
        <Button className="flex-1" onClick={onEdit} type="button" variant="outline">
          <Pencil className="size-4" />
          {t('prospect.read.edit')}
        </Button>
        <Button className="flex-1" onClick={handleViewInApp} type="button" variant="outline">
          <ExternalLink className="size-4" />
          {t('prospect.read.viewInApp')}
        </Button>
      </div>
    </div>
  )
}
