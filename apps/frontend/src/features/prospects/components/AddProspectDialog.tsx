import { vineResolver } from '@hookform/resolvers/vine'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
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
import { PhoneInput } from '@/components/ui/phone-input'
import { SelectField } from '@/components/ui/select-field'
import { Textarea } from '@/components/ui/textarea'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useCreateProspect } from '../hooks/useProspectMutations'
import { createProspectSchema } from '../schemas/prospect'

interface FormValues {
  name: string
  funnel_stage_id: string
  company: string
  linkedin_url: string
  email: string
  phone: string
  title: string
  needed_role: string
  notes: string
}

const OPTIONAL_FIELDS = [
  ['linkedin_url', 'linkedinUrl'],
  ['title', 'title'],
  ['needed_role', 'neededRole'],
  ['company', 'company'],
  ['email', 'email'],
] as const

export function AddProspectDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const create = useCreateProspect()
  const { data: stagesData } = useFunnelStages()
  const stages = stagesData?.data ?? []

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: vineResolver(createProspectSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      name: '',
      funnel_stage_id: '',
      company: '',
      linkedin_url: '',
      email: '',
      phone: '',
      title: '',
      needed_role: '',
      notes: '',
    },
  })

  // Initialize selected stage to first stage when data loads
  useEffect(() => {
    if (stages.length > 0 && !watch('funnel_stage_id')) {
      setValue('funnel_stage_id', stages[0].id)
    }
  }, [stages, watch, setValue])

  // Reset all fields to blank, defaulting the (optional) stage to the first stage
  function resetForm() {
    reset({
      name: '',
      funnel_stage_id: stages[0]?.id ?? '',
      company: '',
      linkedin_url: '',
      email: '',
      phone: '',
      title: '',
      needed_role: '',
      notes: '',
    })
  }

  function onSubmit(values: FormValues) {
    setApiError(null)
    const payload = {
      name: values.name.trim(),
      ...(values.funnel_stage_id && { funnel_stage_id: values.funnel_stage_id }),
      ...(values.company.trim() && { company: values.company.trim() }),
      ...(values.linkedin_url.trim() && { linkedin_url: values.linkedin_url.trim() }),
      ...(values.email.trim() && { email: values.email.trim() }),
      ...(values.phone.trim() && { phone: values.phone.trim() }),
      ...(values.title.trim() && { title: values.title.trim() }),
      ...(values.needed_role.trim() && { needed_role: values.needed_role.trim() }),
      ...(values.notes.trim() && { notes: values.notes.trim() }),
    }
    create.mutate(payload, {
      onSuccess: () => {
        resetForm()
        setOpen(false)
        toast.success(t('prospects.toast.created'))
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setApiError(message ?? t('prospects.toast.createFailed'))
      },
    })
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      resetForm()
      setApiError(null)
    }
    setOpen(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('prospects.addProspect')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('prospects.createForm.title')}</DialogTitle>
          <DialogDescription>{t('prospects.createForm.description')}</DialogDescription>
        </DialogHeader>

        <form id="create-prospect-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Name — required */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="prospect-name">
              {t('prospects.fields.name')}{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="prospect-name"
              {...register('name')}
              placeholder={t('prospects.placeholders.name')}
              autoFocus
            />
            <FieldError errors={[errors.name]} />
          </div>

          {/* Optional text fields: LinkedIn, Poste, Entreprise, Email */}
          {OPTIONAL_FIELDS.map(([field, labelKey]) => (
            <div key={field} className="flex flex-col gap-1">
              <Label htmlFor={`prospect-${field}`}>{t(`prospects.fields.${labelKey}`)}</Label>
              <Input
                id={`prospect-${field}`}
                type={field === 'email' ? 'email' : 'text'}
                {...register(field)}
                placeholder={t(`prospects.placeholders.${labelKey}`)}
              />
              <FieldError errors={[errors[field]]} />
            </div>
          ))}

          {/* Phone — PhoneInput with country selector */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="prospect-phone">{t('prospects.fields.phone')}</Label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  id="prospect-phone"
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? '')}
                  defaultCountry="FR"
                  placeholder={t('prospects.placeholders.phone')}
                  searchPlaceholder={t('phoneInput.searchCountry')}
                  noCountryFound={t('phoneInput.noCountryFound')}
                />
              )}
            />
            <FieldError errors={[errors.phone]} />
          </div>

          {/* Funnel stage — optional */}
          {stages.length > 0 && (
            <SelectField
              control={control}
              name="funnel_stage_id"
              id="prospect-stage"
              label={t('prospects.fields.funnelStage')}
              options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
            />
          )}

          {/* Notes — Textarea */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="prospect-notes">{t('prospects.fields.notes')}</Label>
            <Textarea
              id="prospect-notes"
              {...register('notes')}
              placeholder={t('prospects.placeholders.notes')}
              rows={3}
            />
          </div>

          {/* API-level error */}
          <FieldError>{apiError}</FieldError>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-prospect-form" disabled={create.isPending}>
            {create.isPending ? '...' : t('prospects.createForm.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
