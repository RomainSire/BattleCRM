import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TextField } from '@/components/ui/text-field'
import { ApiError, translateError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { vineResolver } from '@hookform/resolvers/vine'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { useLogin, useRegistrationStatus } from './hooks/useAuth'
import { loginSchema } from './schemas/login'

interface LoginFormValues {
  email: string
  password: string
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: registrationStatus } = useRegistrationStatus()
  const login = useLogin()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: vineResolver(loginSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: LoginFormValues) {
    setServerError(null)
    login.mutate(
      { email: data.email, password: data.password },
      {
        onSuccess: () => navigate('/'),
        onError: (error) => {
          if (error instanceof ApiError && error.errors.length > 0) {
            setServerError(translateError(error.errors[0]))
          }
        },
      },
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('auth.login.title')}</CardTitle>
        <CardDescription>{t('auth.login.description')}</CardDescription>
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
            placeholder={t('auth.fields.password')}
          />

          <div className="flex items-center justify-between">
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>
            {registrationStatus?.allowed && (
              <Button variant="link" asChild>
                <Link to="/register">{t('auth.login.createAccount')}</Link>
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
