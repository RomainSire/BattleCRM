import type { PositioningType } from '@battlecrm/shared'
import type { ReactNode } from 'react'
import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import { useStartBattle } from '../hooks/useStartBattle'

interface StartBattleDialogProps {
  stageId: string
  stageName: string
  positionings: PositioningType[]
  initialVariantAId?: string
  trigger: ReactNode
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
  const [variantAId, setVariantAId] = useState(initialVariantAId ?? '')
  const [variantBId, setVariantBId] = useState('')
  const [sameVariantError, setSameVariantError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const start = useStartBattle()

  // Only active (non-deleted) positionings for this stage
  const stagePositionings = positionings.filter(
    (p) => p.funnelStageId === stageId && p.deletedAt === null,
  )

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setVariantAId(initialVariantAId ?? '')
      setVariantBId('')
      setSameVariantError(null)
      setApiError(null)
    }
    setOpen(newOpen)
  }

  function handleSubmit() {
    setSameVariantError(null)
    setApiError(null)

    if (!variantAId || !variantBId) return

    if (variantAId === variantBId) {
      setSameVariantError(t('dashboard.startBattleDialog.errorSameVariant'))
      return
    }

    start.mutate(
      { funnel_stage_id: stageId, variant_a_id: variantAId, variant_b_id: variantBId },
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

  const canSubmit = !!variantAId && !!variantBId && !start.isPending

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

        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <Label>{t('dashboard.startBattleDialog.variantA')}</Label>
            <Select value={variantAId} onValueChange={setVariantAId} disabled={start.isPending}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('dashboard.startBattleDialog.selectVariant')} />
              </SelectTrigger>
              <SelectContent>
                {stagePositionings.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <Label>{t('dashboard.startBattleDialog.variantB')}</Label>
            <Select value={variantBId} onValueChange={setVariantBId} disabled={start.isPending}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('dashboard.startBattleDialog.selectVariant')} />
              </SelectTrigger>
              <SelectContent>
                {stagePositionings.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{sameVariantError}</FieldError>
          </div>

          <FieldError>{apiError}</FieldError>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {start.isPending ? '...' : t('dashboard.startBattleDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
