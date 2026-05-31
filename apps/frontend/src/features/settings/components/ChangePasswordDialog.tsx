import { useState } from 'react'
import { vineResolver } from '@hookform/resolvers/vine'
import { useForm } from 'react-hook-form'
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
import { TextField } from '@/components/ui/text-field'
import { useChangePassword } from '@/features/auth/hooks/useAuth'
import { ApiError, translateError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { changePasswordSchema } from '../schemas/changePassword'

interface FormValues {
  currentPassword: string
  newPassword: string
  newPasswordConfirmation: string
}

export function ChangePasswordDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const changePassword = useChangePassword()

  const form = useForm<FormValues>({
    resolver: vineResolver(changePasswordSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      newPasswordConfirmation: '',
    },
  })

  function handleOpenChange(value: boolean) {
    if (!value) form.reset()
    setOpen(value)
  }

  function onSubmit(data: FormValues) {
    changePassword.mutate(data, {
      onSuccess: () => {
        form.reset()
        setOpen(false)
        toast.success(t('settings.security.changePassword.success'))
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          for (const err of error.errors) {
            if (err.field) {
              form.setError(err.field as keyof FormValues, {
                message: translateError(err),
              })
            }
          }
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">{t('settings.security.changePassword.trigger')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.security.changePassword.trigger')}</DialogTitle>
          <DialogDescription>{t('settings.security.changePassword.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <TextField
            control={form.control}
            name="currentPassword"
            label={t('settings.security.changePassword.currentPassword')}
            type="password"
            placeholder={t('auth.placeholders.password')}
          />
          <TextField
            control={form.control}
            name="newPassword"
            label={t('settings.security.changePassword.newPassword')}
            type="password"
            placeholder={t('auth.placeholders.password')}
          />
          <TextField
            control={form.control}
            name="newPasswordConfirmation"
            label={t('settings.security.changePassword.confirmPassword')}
            type="password"
            placeholder={t('auth.placeholders.confirmPassword')}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending
                ? t('settings.security.changePassword.submitting')
                : t('settings.security.changePassword.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
