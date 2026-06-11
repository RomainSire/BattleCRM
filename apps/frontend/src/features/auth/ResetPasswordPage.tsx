import { vineResolver } from '@hookform/resolvers/vine'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { AppLogo } from '@/components/common/AppLogo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TextField } from '@/components/ui/text-field'
import { ApiError, translateError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useResetPassword } from './hooks/useAuth'
import { resetPasswordSchema } from './schemas/resetPassword'

interface ResetPasswordFormValues {
  password: string
  passwordConfirmation: string
}

export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const resetPassword = useResetPassword()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<ResetPasswordFormValues>({
    resolver: vineResolver(resetPasswordSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: { password: '', passwordConfirmation: '' },
  })

  function onSubmit(data: ResetPasswordFormValues) {
    if (!token) {
      return
    }
    setServerError(null)
    resetPassword.mutate(
      { token, password: data.password, passwordConfirmation: data.passwordConfirmation },
      {
        onSuccess: () => {
          toast.success(t('auth.resetPassword.success'))
          navigate('/login')
        },
        onError: (error) => {
          if (error instanceof ApiError && error.errors.length > 0) {
            setServerError(translateError(error.errors[0]))
          } else {
            setServerError(t('common.error'))
          }
        },
      },
    )
  }

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-2 text-center">
          <AppLogo size="lg" className="mb-2" />
          <CardTitle>{t('auth.resetPassword.title')}</CardTitle>
          <CardDescription>{t('auth.resetPassword.missingToken')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="link" asChild className="p-0">
            <Link to="/forgot-password">{t('auth.resetPassword.requestNewLink')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-col items-center gap-2 text-center">
        <AppLogo size="lg" className="mb-2" />
        <CardTitle>{t('auth.resetPassword.title')}</CardTitle>
        <CardDescription>{t('auth.resetPassword.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div role="alert" className="text-destructive text-sm font-medium">
              {serverError}
            </div>
          )}

          <TextField
            control={form.control}
            name="password"
            label={t('auth.fields.newPassword')}
            type="password"
            placeholder={t('auth.placeholders.password')}
          />

          <TextField
            control={form.control}
            name="passwordConfirmation"
            label={t('auth.fields.confirmPassword')}
            type="password"
            placeholder={t('auth.placeholders.confirmPassword')}
          />

          <div className="flex items-center justify-between">
            <Button type="submit" disabled={resetPassword.isPending}>
              {resetPassword.isPending
                ? t('auth.resetPassword.submitting')
                : t('auth.resetPassword.submit')}
            </Button>
            <Button variant="link" asChild>
              <Link to="/login">{t('auth.resetPassword.backToLogin')}</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
