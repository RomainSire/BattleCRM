import { vineResolver } from '@hookform/resolvers/vine'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useCreateFunnelStage } from '../hooks/useFunnelStages'
import { funnelStageSchema } from '../schemas/funnelStage'

interface FormValues {
  name: string
}

export function AddStageForm() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const create = useCreateFunnelStage()
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: vineResolver(funnelStageSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: { name: '' },
  })
  const nameValue = watch('name')

  function onSubmit({ name }: FormValues) {
    setApiError(null)
    create.mutate(name.trim(), {
      onSuccess: () => {
        reset()
        setIsOpen(false)
        toast.success(t('funnelStages.toast.added'))
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setApiError(message ?? t('funnelStages.toast.addFailed'))
      },
    })
  }

  function handleCancel() {
    reset()
    setApiError(null)
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="w-full">
        <Plus className="size-4" />
        {t('funnelStages.addStage')}
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-center gap-2">
      <div className="flex flex-1 flex-col gap-1">
        <Input
          {...register('name')}
          placeholder={t('funnelStages.stageName')}
          autoFocus
          className="flex-1"
          aria-label={t('funnelStages.stageName')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCancel()
          }}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        {apiError && <p className="text-xs text-destructive">{apiError}</p>}
      </div>
      <Button type="submit" size="sm" disabled={create.isPending || !nameValue.trim()}>
        {create.isPending ? '...' : t('funnelStages.add')}
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={handleCancel}
        aria-label={t('funnelStages.aria.cancelAdd')}
      >
        <X className="size-4" />
      </Button>
    </form>
  )
}
