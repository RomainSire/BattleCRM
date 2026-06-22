import type { PositioningType } from '@battlecrm/shared'
import { vineResolver } from '@hookform/resolvers/vine'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ComboboxField } from '@/components/ui/combobox-field'
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
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useStartBattle } from '../hooks/useStartBattle'
import { startBattleSchema } from '../schemas/startBattle'

interface StartBattleDialogProps {
  stageId: string
  stageName: string
  positionings: PositioningType[]
  initialVariantAId?: string
  trigger: ReactNode
}

interface FormValues {
  variant_a_id: string
  variant_b_id: string
}

export function StartBattleDialog({
  stageId,
  stageName,
  positionings,
  initialVariantAId,
  trigger,
}: StartBattleDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const start = useStartBattle()

  const { control, handleSubmit, reset, setError } = useForm<FormValues>({
    resolver: vineResolver(startBattleSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: { variant_a_id: initialVariantAId ?? '', variant_b_id: '' },
  })

  // Only active (non-deleted) positionings for this stage
  const stagePositionings = positionings.filter(
    (p) => p.funnelStageId === stageId && p.deletedAt === null,
  )
  const variantOptions = stagePositionings.map((p) => ({ value: p.id, label: p.name }))

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      reset({ variant_a_id: initialVariantAId ?? '', variant_b_id: '' })
      setApiError(null)
    }
    setOpen(newOpen)
  }

  function onSubmit(values: FormValues) {
    setApiError(null)

    if (values.variant_a_id === values.variant_b_id) {
      setError('variant_b_id', { message: t('dashboard.startBattleDialog.errorSameVariant') })
      return
    }

    start.mutate(
      {
        funnel_stage_id: stageId,
        variant_a_id: values.variant_a_id,
        variant_b_id: values.variant_b_id,
      },
      {
        onSuccess: () => {
          setOpen(false)
          toast.success(t('dashboard.startBattleDialog.successToast'))
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setApiError(message ?? t('dashboard.startBattleDialog.errorGeneric'))
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dashboard.startBattleDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('dashboard.startBattleDialog.description', { stage: stageName })}
          </DialogDescription>
        </DialogHeader>

        <form id="start-battle-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <ComboboxField
            control={control}
            name="variant_a_id"
            label={t('dashboard.startBattleDialog.variantA')}
            required
            disabled={start.isPending}
            placeholder={t('dashboard.startBattleDialog.selectVariant')}
            options={variantOptions}
          />

          <ComboboxField
            control={control}
            name="variant_b_id"
            label={t('dashboard.startBattleDialog.variantB')}
            required
            disabled={start.isPending}
            placeholder={t('dashboard.startBattleDialog.selectVariant')}
            options={variantOptions}
          />

          <FieldError>{apiError}</FieldError>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="start-battle-form" disabled={start.isPending}>
            {start.isPending ? '...' : t('dashboard.startBattleDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
