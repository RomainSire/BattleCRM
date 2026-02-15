import { vineResolver } from '@hookform/resolvers/vine'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TextField } from '@/components/ui/text-field'
import { ApiError, translateError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useRegister, useRegistrationStatus } from './hooks/useAuth'
import { registerSchema } from './schemas/schemas'

interface RegisterFormValues {
  email: string
  password: string
  passwordConfirmation: string
}

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: registrationStatus, isLoading: isLoadingStatus } = useRegistrationStatus()
  const register = useRegister()

  const form = useForm<RegisterFormValues>({
    resolver: vineResolver(registerSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirmation: '',
    },
  })

  async function onSubmit(data: RegisterFormValues) {
    register.mutate(
      { email: data.email, password: data.password },
      {
        onSuccess: () => navigate('/'),
        onError: (error) => {
          if (error instanceof ApiError) {
            for (const err of error.errors) {
              if (err.field) {
                form.setError(err.field as keyof RegisterFormValues, {
                  message: translateError(err),
                })
              }
            }
          }
        },
      },
    )
  }

  if (isLoadingStatus) {
    return null
  }

  if (!registrationStatus?.allowed) {
    return (
      <div className="relative flex min-h-screen items-center justify-center p-8">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('auth.registrationDisabled.title')}</CardTitle>
            <CardDescription>{t('auth.registrationDisabled.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="link" asChild className="p-0">
              <Link to="/login">{t('auth.registrationDisabled.goToLogin')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-8">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.register.title')}</CardTitle>
          <CardDescription>{t('auth.register.description')}</CardDescription>
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

            <TextField
              control={form.control}
              name="password"
              label={t('auth.fields.password')}
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
              <Button type="submit" disabled={register.isPending}>
                {register.isPending ? t('auth.register.submitting') : t('auth.register.submit')}
              </Button>
              <Button variant="link" asChild>
                <Link to="/login">{t('auth.register.signIn')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
