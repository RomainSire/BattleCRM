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
import { ApiError } from '@/lib/api'
import { useCancelBattle } from '../hooks/useCancelBattle'

interface CancelBattleDialogProps {
  battle: BattleType
}

export function CancelBattleDialog({ battle }: CancelBattleDialogProps) {
  const { t } = useTranslation()
  const [apiError, setApiError] = useState<string | null>(null)

  const cancel = useCancelBattle()

  function handleConfirm() {
    setApiError(null)

    cancel.mutate(battle.id, {
      onSuccess: () => {
        toast.success(t('dashboard.cancelBattleDialog.successToast'))
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        const text = message ?? t('dashboard.cancelBattleDialog.errorGeneric')
        setApiError(text)
        toast.error(text)
      },
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t('dashboard.cancelBattle')}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('dashboard.cancelBattleDialog.title', { n: battle.battleNumber })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('dashboard.cancelBattleDialog.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {apiError && <FieldError>{apiError}</FieldError>}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setApiError(null)}>
            {t('dashboard.cancelBattleDialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={cancel.isPending}>
            {cancel.isPending ? '...' : t('dashboard.cancelBattleDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
