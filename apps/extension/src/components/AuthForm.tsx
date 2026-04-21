import { useEffect } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useLoginExtension } from '../features/auth/hooks/useAuth'
import { HttpError } from '../lib/api'

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

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="text-center">
        <h1 className="text-base font-bold text-gray-900">{t('auth.title')}</h1>
        <p className="mt-0.5 text-xs text-gray-500">{t('auth.subtitle')}</p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700" htmlFor="baseUrl">
            {t('auth.fields.url')}
          </label>
          <input
            {...register('baseUrl', { required: t('validation.required') })}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
            id="baseUrl"
            placeholder={t('auth.placeholders.url')}
            type="text"
          />
          {errors.baseUrl && <p className="text-xs text-red-600">{errors.baseUrl.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700" htmlFor="email">
            {t('auth.fields.email')}
          </label>
          <input
            {...register('email', {
              required: t('validation.required'),
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: t('validation.email'),
              },
            })}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
            id="email"
            placeholder={t('auth.placeholders.email')}
            type="email"
          />
          {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-700" htmlFor="password">
            {t('auth.fields.password')}
          </label>
          <input
            {...register('password', { required: t('validation.required') })}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
            id="password"
            type="password"
          />
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {errors.root && <p className="text-xs text-red-600">{errors.root.message}</p>}

        <button
          className="mt-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting || login.isPending}
          type="submit"
        >
          {isSubmitting || login.isPending ? t('auth.submitting') : t('auth.submit')}
        </button>
      </form>
    </div>
  )
}
