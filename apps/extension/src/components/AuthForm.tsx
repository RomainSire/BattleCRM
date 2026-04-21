import { useEffect } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLoginExtension } from '../features/auth/hooks/useAuth'
import { HttpError } from '../lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { PasswordInput } from './ui/password-input'

interface AuthFormProps {
  onSuccess: (email: string) => void
  initialError?: string
}

interface LoginFormValues {
  baseUrl: string
  email: string
  password: string
}

export default function AuthForm({ onSuccess, initialError }: AuthFormProps) {
  const { t } = useTranslation()
  const login = useLoginExtension()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: { baseUrl: '', email: '', password: '' },
    mode: 'onTouched',
  })

  useEffect(() => {
    if (initialError) {
      setError('root', { message: initialError })
    }
  }, [initialError, setError])

  const onSubmit: SubmitHandler<LoginFormValues> = (data) => {
    const tokenName = browser.runtime.getManifest().name
    login.mutate(
      { baseUrl: data.baseUrl, email: data.email, password: data.password, tokenName },
      {
        onSuccess: ({ email }) => onSuccess(email),
        onError: (err) => {
          if (err instanceof HttpError && err.status === 401) {
            setError('root', { message: t('auth.errors.invalidCredentials') })
          } else {
            setError('root', { message: t('auth.errors.serverUnreachable') })
          }
        },
      },
    )
  }

  const isPending = isSubmitting || login.isPending

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <img alt="BattleCRM" className="h-8 w-auto" src="/BattleCRM_logo.svg" />
          <span className="font-bold text-2xl text-brand-gradient">{t('common.appName')}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t('auth.subtitle')}</p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="baseUrl">{t('auth.fields.url')}</Label>
          <Input
            {...register('baseUrl', { required: t('validation.required') })}
            aria-invalid={!!errors.baseUrl}
            disabled={isPending}
            id="baseUrl"
            placeholder={t('auth.placeholders.url')}
            type="text"
          />
          {errors.baseUrl && <p className="text-xs text-destructive">{errors.baseUrl.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t('auth.fields.email')}</Label>
          <Input
            {...register('email', {
              required: t('validation.required'),
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: t('validation.email'),
              },
            })}
            aria-invalid={!!errors.email}
            disabled={isPending}
            id="email"
            placeholder={t('auth.placeholders.email')}
            type="email"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">{t('auth.fields.password')}</Label>
          <PasswordInput
            {...register('password', { required: t('validation.required') })}
            aria-invalid={!!errors.password}
            disabled={isPending}
            id="password"
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {errors.root && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errors.root.message}
          </p>
        )}

        <Button className="mt-1 w-full" disabled={isPending} type="submit">
          {isPending ? t('auth.submitting') : t('auth.submit')}
        </Button>
      </form>
    </div>
  )
}
