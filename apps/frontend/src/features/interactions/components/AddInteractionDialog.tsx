import type { InteractionStatus } from '@battlecrm/shared'
import { vineResolver } from '@hookform/resolvers/vine'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePositionings } from '@/features/positionings/hooks/usePositionings'
import { useProspects } from '@/features/prospects/hooks/useProspects'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useCreateInteraction } from '../hooks/useInteractionMutations'
import { useLastInteractionContext } from '../hooks/useLastInteractionContext'
import { createInteractionSchema } from '../schemas/interaction'

interface AddInteractionDialogProps {
  initialProspectId?: string
  trigger?: ReactNode
}

interface FormValues {
  notes: string
}

export function AddInteractionDialog({ initialProspectId, trigger }: AddInteractionDialogProps) {
  const { t } = useTranslation()
  const { lastProspectId, getLastPositioningForStage, saveContext } = useLastInteractionContext()

  const [open, setOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [selectedProspectId, setSelectedProspectId] = useState(
    initialProspectId ?? lastProspectId ?? '',
  )
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedPositioningId, setSelectedPositioningId] = useState<string>('none')
  const [prospectError, setProspectError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const create = useCreateInteraction()
  const { data: prospectsData, isLoading: prospectsLoading } = useProspects()
  const prospects = prospectsData?.data ?? []
  const selectedProspect = prospects.find((p) => p.id === selectedProspectId)

  const { data: stagesData } = useFunnelStages()
  const stages = stagesData?.data ?? []
  const currentStage = stages.find((s) => s.id === selectedProspect?.funnelStageId)

  const { data: positioningsData, isLoading: positioningsLoading } = usePositionings(
    selectedProspect?.funnelStageId
      ? { funnel_stage_id: selectedProspect.funnelStageId }
      : undefined,
    { enabled: !!selectedProspect?.funnelStageId },
  )
  const positionings = positioningsData?.data ?? []

  // Pre-fill last used positioning for this funnel stage once positionings load
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only run when positionings load, not on every selectedPositioningId change
  useEffect(() => {
    if (positioningsLoading || selectedPositioningId !== 'none' || !selectedProspect?.funnelStageId)
      return
    const lastId = getLastPositioningForStage(selectedProspect.funnelStageId)
    if (!lastId) return
    const found = positionings.find((p) => p.id === lastId)
    if (found) {
      setSelectedPositioningId(lastId)
    }
  }, [positioningsLoading, positionings, selectedProspect?.funnelStageId])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: vineResolver(createInteractionSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: { notes: '' },
  })

  function onSubmit(values: FormValues) {
    let valid = true
    if (!selectedProspectId) {
      setProspectError(t('validation.required', { field: t('interactions.fields.prospect') }))
      valid = false
    } else {
      setProspectError(null)
    }
    if (!selectedStatus) {
      setStatusError(t('validation.required', { field: t('interactions.fields.status') }))
      valid = false
    } else {
      setStatusError(null)
    }
    if (!valid) return

    setApiError(null)
    create.mutate(
      {
        prospect_id: selectedProspectId,
        status: selectedStatus as InteractionStatus,
        positioning_id: selectedPositioningId === 'none' ? null : selectedPositioningId,
        notes: values.notes || null,
      },
      {
        onSuccess: () => {
          saveContext(selectedProspectId, selectedProspect?.funnelStageId, selectedPositioningId)
          resetAll()
          setOpen(false)
          toast.success(t('interactions.toast.created'))
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setApiError(message ?? t('interactions.toast.createFailed'))
        },
      },
    )
  }

  function resetAll() {
    reset()
    setSelectedProspectId(initialProspectId ?? '')
    setSelectedStatus('')
    setSelectedPositioningId('none')
    setProspectError(null)
    setStatusError(null)
    setApiError(null)
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) resetAll()
    setOpen(newOpen)
  }

  function handleProspectChange(value: string) {
    setSelectedProspectId(value)
    setSelectedPositioningId('none')
    setProspectError(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm">{t('interactions.addInteraction')}</Button>}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('interactions.createForm.title')}</DialogTitle>
          <DialogDescription>{t('interactions.createForm.description')}</DialogDescription>
        </DialogHeader>

        <form id="create-interaction-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Prospect — required */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="interaction-prospect">
              {t('interactions.fields.prospect')}{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            {prospectsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={selectedProspectId} onValueChange={handleProspectChange}>
                <SelectTrigger id="interaction-prospect" className="w-full">
                  <SelectValue placeholder={t('interactions.placeholders.selectProspect')} />
                </SelectTrigger>
                <SelectContent>
                  {prospects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {currentStage && <p className="text-xs text-muted-foreground">{currentStage.name}</p>}
            <FieldError>{prospectError}</FieldError>
          </div>

          {/* Status — required, ToggleGroup */}
          <div className="flex flex-col gap-1">
            <Label>
              {t('interactions.fields.status')}{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <ToggleGroup
              type="single"
              value={selectedStatus}
              onValueChange={(value) => {
                if (value) {
                  setSelectedStatus(value)
                  setStatusError(null)
                }
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="positive" aria-label={t('interactions.status.positive')}>
                ✅ {t('interactions.status.positive')}
              </ToggleGroupItem>
              <ToggleGroupItem value="pending" aria-label={t('interactions.status.pending')}>
                ⏳ {t('interactions.status.pending')}
              </ToggleGroupItem>
              <ToggleGroupItem value="negative" aria-label={t('interactions.status.negative')}>
                ❌ {t('interactions.status.negative')}
              </ToggleGroupItem>
            </ToggleGroup>
            <FieldError>{statusError}</FieldError>
          </div>

          {/* Positioning — optional, filtered by prospect's funnel stage */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="interaction-positioning">{t('interactions.fields.positioning')}</Label>
            {positioningsLoading && selectedProspect ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={selectedPositioningId}
                onValueChange={setSelectedPositioningId}
                disabled={!selectedProspect}
              >
                <SelectTrigger id="interaction-positioning" className="w-full">
                  <SelectValue placeholder={t('interactions.placeholders.selectPositioning')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('interactions.noPositioning')}</SelectItem>
                  {positionings.map((pos) => (
                    <SelectItem key={pos.id} value={pos.id}>
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Notes — optional */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="interaction-notes">{t('interactions.fields.notes')}</Label>
            <Textarea
              id="interaction-notes"
              {...register('notes')}
              placeholder={t('interactions.placeholders.notes')}
              rows={3}
            />
            <FieldError errors={[errors.notes]} />
          </div>

          {/* API-level error */}
          <FieldError>{apiError}</FieldError>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="create-interaction-form" disabled={create.isPending}>
            {create.isPending ? '...' : t('interactions.createForm.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
