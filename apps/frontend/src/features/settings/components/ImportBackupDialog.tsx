import { FileArchive, Paperclip, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
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
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, translateError } from '@/lib/api'
import { useImportBackup } from '../hooks/useBackup'

interface FormValues {
  file: File | null
  confirmation: string
}

// Vine is not used here: a File instance and equality to a runtime-translated word
// cannot be expressed in a static Vine schema. Validation lives in RHF rules instead.
export function ImportBackupDialog() {
  const { t } = useTranslation()
  const confirmWord = t('settings.backup.import.confirmWord')
  const [open, setOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importBackup = useImportBackup()

  const { control, handleSubmit, reset, watch } = useForm<FormValues>({
    defaultValues: { file: null, confirmation: '' },
  })

  // Gate the destructive submit button (disabled until valid). RHF rules still guard
  // the keyboard (Enter) submit path and surface field-level error messages.
  const file = watch('file')
  const confirmation = watch('confirmation')
  const canSubmit = file !== null && confirmation.trim() === confirmWord && !importBackup.isPending

  function clearNativeFileInput() {
    // Clear the native value so re-selecting the same file fires onChange again.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      reset()
      clearNativeFileInput()
    }
    setOpen(value)
  }

  function onSubmit({ file }: FormValues) {
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
        <form id="import-backup-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            control={control}
            name="file"
            rules={{ required: t('settings.backup.import.fileRequired') }}
            render={({ field, fieldState }) => (
              <div className="space-y-2">
                <Label htmlFor="backup-file">{t('settings.backup.import.fileLabel')}</Label>
                <input
                  ref={fileInputRef}
                  id="backup-file"
                  type="file"
                  accept=".gz"
                  className="sr-only"
                  onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
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
                  {field.value ? (
                    <div className="flex min-w-0 items-center gap-1.5 text-sm">
                      <FileArchive className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{field.value.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          field.onChange(null)
                          clearNativeFileInput()
                        }}
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
                <FieldError errors={[fieldState.error]} />
              </div>
            )}
          />

          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {t('settings.backup.import.warning')}
          </p>

          <Controller
            control={control}
            name="confirmation"
            rules={{
              validate: (value) =>
                value.trim() === confirmWord || t('settings.backup.import.confirmMismatch'),
            }}
            render={({ field, fieldState }) => (
              <div className="space-y-2">
                <Label htmlFor="backup-confirm">
                  {t('settings.backup.import.confirmLabel', { word: confirmWord })}
                </Label>
                <Input
                  id="backup-confirm"
                  {...field}
                  placeholder={confirmWord}
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </div>
            )}
          />
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form="import-backup-form"
            variant="destructive"
            disabled={!canSubmit}
          >
            {importBackup.isPending
              ? t('settings.backup.import.submitting')
              : t('settings.backup.import.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
