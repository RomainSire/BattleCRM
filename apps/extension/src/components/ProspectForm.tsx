import { vineResolver } from '@hookform/resolvers/vine'
import { useEffect, useRef } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { prospectSchema } from '../features/prospects/schemas/prospect'
import { i18nMessagesProvider } from '../lib/validation'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export interface ProspectFormFields {
  name: string
  title: string
  company: string
  email: string
  phone: string
}

interface ProspectFormProps {
  mode: 'add' | 'edit'
  defaultValues: ProspectFormFields
  linkedinUrl: string
  hasUnsavedChanges?: boolean
  serverError?: string
  isPending: boolean
  onFieldChange: (fields: ProspectFormFields) => void
  onSubmit: (fields: ProspectFormFields) => void
  onCancel?: () => void
  onReset?: () => void
}

export default function ProspectForm({
  mode,
  defaultValues,
  linkedinUrl,
  hasUnsavedChanges,
  serverError,
  isPending,
  onFieldChange,
  onSubmit,
  onCancel,
  onReset,
}: ProspectFormProps) {
  const { t } = useTranslation()
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const isEdit = mode === 'edit'

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProspectFormFields>({
    resolver: vineResolver(prospectSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues,
  })

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  useEffect(() => {
    const subscription = watch((values) => {
      onFieldChange(values as ProspectFormFields)
    })
    return () => subscription.unsubscribe()
  }, [watch, onFieldChange])

  const { ref: rhfNameRef, ...nameRest } = register('name')

  const onFormSubmit: SubmitHandler<ProspectFormFields> = (data) => {
    onSubmit(data)
  }

  return (
    <div className="flex flex-col gap-0">
      {hasUnsavedChanges && !isEdit && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <span>{t('prospect.form.unsavedBanner')}</span>
          {onReset && (
            <button className="ml-2 underline hover:text-amber-900" onClick={onReset} type="button">
              {t('prospect.form.reset')}
            </button>
          )}
        </div>
      )}

      {isEdit && (
        <div className="mx-4 mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {t('prospect.form.editBanner')}
        </div>
      )}

      {serverError && (
        <div className="mx-4 mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {serverError}
        </div>
      )}

      <form className="flex flex-col gap-2.5 px-4 py-3" onSubmit={handleSubmit(onFormSubmit)}>
        <div className="flex flex-col gap-1">
          <Label className="text-xs" htmlFor="name">
            {t('prospect.form.name')} *
          </Label>
          <Input
            {...nameRest}
            ref={(el) => {
              rhfNameRef(el)
              nameInputRef.current = el
            }}
            aria-invalid={!!errors.name}
            className="h-8 text-xs"
            disabled={isPending}
            id="name"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs" htmlFor="title">
            {t('prospect.form.title')}
          </Label>
          <Input {...register('title')} className="h-8 text-xs" disabled={isPending} id="title" />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs" htmlFor="company">
            {t('prospect.form.company')}
          </Label>
          <Input
            {...register('company')}
            className="h-8 text-xs"
            disabled={isPending}
            id="company"
            placeholder={t('prospect.form.companyPlaceholder')}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs" htmlFor="email">
            {t('prospect.form.email')}
          </Label>
          <Input
            {...register('email')}
            className="h-8 text-xs"
            disabled={isPending}
            id="email"
            type="email"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs" htmlFor="phone">
            {t('prospect.form.phone')}
          </Label>
          <Input
            {...register('phone')}
            className="h-8 text-xs"
            disabled={isPending}
            id="phone"
            type="tel"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs" htmlFor="linkedinUrl">
            {t('prospect.form.linkedinUrl')}
          </Label>
          <Input
            className="h-8 cursor-not-allowed bg-muted text-xs text-muted-foreground"
            disabled
            id="linkedinUrl"
            readOnly
            value={linkedinUrl}
          />
        </div>

        <div className={`flex gap-2 pt-1 ${isEdit ? '' : 'flex-col'}`}>
          {isEdit && (
            <Button
              className="flex-1"
              disabled={isPending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              {t('prospect.form.cancel')}
            </Button>
          )}
          <Button className={isEdit ? 'flex-1' : 'w-full'} disabled={isPending} type="submit">
            {isPending
              ? t('prospect.form.submitting')
              : isEdit
                ? t('prospect.form.submitEdit')
                : t('prospect.form.submitAdd')}
          </Button>
        </div>
      </form>
    </div>
  )
}
