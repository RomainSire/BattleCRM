import { vineResolver } from '@hookform/resolvers/vine'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AppLogo } from '@/components/common/AppLogo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TextField } from '@/components/ui/text-field'
import { i18nMessagesProvider } from '@/lib/validation'
import { useForgotPassword } from './hooks/useAuth'
import { forgotPasswordSchema } from './schemas/forgotPassword'

interface ForgotPasswordFormValues {
  email: string
}

export function ForgotPasswordPage() {
  const { t, i18n } = useTranslation()
  const forgotPassword = useForgotPassword()
  const [submitted, setSubmitted] = useState(false)

  const form = useForm<ForgotPasswordFormValues>({
    resolver: vineResolver(forgotPasswordSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: { email: '' },
  })

  function onSubmit(data: ForgotPasswordFormValues) {
    // Always show the same confirmation regardless of whether the email exists
    // (server responds identically to prevent account enumeration).
    // Normalize to a supported locale so the backend email matches the UI language.
    const locale = (i18n.resolvedLanguage ?? i18n.language).startsWith('fr') ? 'fr' : 'en'
    forgotPassword.mutate(
      { email: data.email, locale },
      {
        onSettled: () => setSubmitted(true),
      },
    )
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-2 text-center">
          <AppLogo size="lg" className="mb-2" />
          <CardTitle>{t('auth.forgotPassword.title')}</CardTitle>
          <CardDescription>{t('auth.forgotPassword.emailSent')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="link" asChild className="p-0">
            <Link to="/login">{t('auth.forgotPassword.backToLogin')}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-col items-center gap-2 text-center">
        <AppLogo size="lg" className="mb-2" />
        <CardTitle>{t('auth.forgotPassword.title')}</CardTitle>
        <CardDescription>{t('auth.forgotPassword.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <TextField
            control={form.control}
            name="email"
            label={t('auth.fields.email')}
            type="email"
            placeholder={t('auth.placeholders.email')}
          />

          <div className="flex items-center justify-between">
            <Button type="submit" disabled={forgotPassword.isPending}>
              {forgotPassword.isPending
                ? t('auth.forgotPassword.submitting')
                : t('auth.forgotPassword.submit')}
            </Button>
            <Button variant="link" asChild>
              <Link to="/login">{t('auth.forgotPassword.backToLogin')}</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
