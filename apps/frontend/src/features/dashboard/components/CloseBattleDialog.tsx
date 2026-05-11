import type { BattleType } from '@battlecrm/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ApiError } from '@/lib/api'
import { useCloseBattle } from '../hooks/useCloseBattle'

interface CloseBattleDialogProps {
  battle: BattleType
  leadingVariantId: string | null
  disabled: boolean
  resolveName: (id: string) => string
}

export function CloseBattleDialog({
  battle,
  leadingVariantId,
  disabled,
  resolveName,
}: CloseBattleDialogProps) {
  const { t } = useTranslation()
  const [apiError, setApiError] = useState<string | null>(null)

  const close = useCloseBattle()

  function handleConfirm() {
    if (!leadingVariantId) return
    setApiError(null)

    close.mutate(
      { id: battle.id, winner_id: leadingVariantId },
      {
        onSuccess: () => {
          toast.success(
            t('dashboard.closeBattleDialog.successToast', {
              winner: resolveName(leadingVariantId),
            }),
          )
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          const text = message ?? t('dashboard.closeBattleDialog.errorGeneric')
          setApiError(text)
          toast.error(text)
        },
      },
    )
  }

  const winnerName = leadingVariantId ? resolveName(leadingVariantId) : '—'

  return (
    <AlertDialog>
      {/* Shadcn Tooltip does not show on disabled buttons — wrap in span */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" disabled={disabled}>
                {t('dashboard.closeBattle')}
              </Button>
            </AlertDialogTrigger>
          </span>
        </TooltipTrigger>
        {disabled && (
          <TooltipContent>
            <p className="text-xs">{t('dashboard.closeBattleDisabledTooltip')}</p>
          </TooltipContent>
        )}
      </Tooltip>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('dashboard.closeBattleDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('dashboard.closeBattleDialog.description', { n: battle.battleNumber })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p className="text-sm">{t('dashboard.closeBattleDialog.winner', { name: winnerName })}</p>

        {apiError && <FieldError>{apiError}</FieldError>}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setApiError(null)}>
            {t('dashboard.closeBattleDialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={close.isPending || !leadingVariantId}
          >
            {close.isPending ? '...' : t('dashboard.closeBattleDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
