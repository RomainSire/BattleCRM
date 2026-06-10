import { FileArchive, Paperclip, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, translateError } from '@/lib/api'
import { useImportBackup } from '../hooks/useBackup'

export function ImportBackupDialog() {
  const { t } = useTranslation()
  const confirmWord = t('settings.backup.import.confirmWord')
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importBackup = useImportBackup()

  function clearFileInput() {
    setFile(null)
    // Clear the native value so re-selecting the same file fires onChange again.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function reset() {
    clearFileInput()
    setConfirmation('')
  }

  function handleOpenChange(value: boolean) {
    if (!value) reset()
    setOpen(value)
  }

  function handleSubmit() {
    if (!file) return
    importBackup.mutate(file, {
      onSuccess: () => {
        handleOpenChange(false)
        toast.success(t('settings.backup.import.success'))
      },
      onError: (error) => {
        const message =
          error instanceof ApiError
            ? translateError(error.errors[0])
            : t('settings.backup.import.error')
        toast.error(message)
      },
    })
  }

  const canSubmit = file !== null && confirmation.trim() === confirmWord && !importBackup.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructiveOutline" className="gap-2">
          <Upload className="size-4" />
          {t('settings.backup.import.trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.backup.import.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('settings.backup.import.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backup-file">{t('settings.backup.import.fileLabel')}</Label>
            <input
              ref={fileInputRef}
              id="backup-file"
              type="file"
              accept=".gz"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
                {t('settings.backup.import.chooseFile')}
              </Button>
              {file ? (
                <div className="flex min-w-0 items-center gap-1.5 text-sm">
                  <FileArchive className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={clearFileInput}
                    aria-label={t('settings.backup.import.removeFile')}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <span className="truncate text-sm text-muted-foreground">
                  {t('settings.backup.import.noFile')}
                </span>
              )}
            </div>
          </div>
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {t('settings.backup.import.warning')}
          </p>
          <div className="space-y-2">
            <Label htmlFor="backup-confirm">
              {t('settings.backup.import.confirmLabel', { word: confirmWord })}
            </Label>
            <Input
              id="backup-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={confirmWord}
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit}>
            {importBackup.isPending
              ? t('settings.backup.import.submitting')
              : t('settings.backup.import.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
