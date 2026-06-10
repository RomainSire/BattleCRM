import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ApiError, translateError } from '@/lib/api'
import { useExportBackup } from '../hooks/useBackup'
import { ImportBackupDialog } from './ImportBackupDialog'

export function BackupSection() {
  const { t } = useTranslation()
  const exportBackup = useExportBackup()

  function handleExport() {
    exportBackup.mutate(undefined, {
      onSuccess: () => toast.success(t('settings.backup.export.success')),
      onError: (error) => {
        const message =
          error instanceof ApiError
            ? translateError(error.errors[0])
            : t('settings.backup.export.error')
        toast.error(message)
      },
    })
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <p className="text-sm font-medium">{t('settings.backup.export.title')}</p>
          <p className="text-sm text-muted-foreground">{t('settings.backup.export.description')}</p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleExport}
          disabled={exportBackup.isPending}
        >
          <Download className="size-4" />
          {exportBackup.isPending
            ? t('settings.backup.export.submitting')
            : t('settings.backup.export.trigger')}
        </Button>
      </section>

      <Separator />

      <section className="space-y-3">
        <div>
          <p className="text-sm font-medium text-destructive">
            {t('settings.backup.import.title')}
          </p>
          <p className="text-sm text-muted-foreground">{t('settings.backup.import.description')}</p>
        </div>
        <ImportBackupDialog />
      </section>
    </div>
  )
}
