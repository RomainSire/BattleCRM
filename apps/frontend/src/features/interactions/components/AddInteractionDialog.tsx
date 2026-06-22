import { vineResolver } from '@hookform/resolvers/vine'
import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  prospect_id: string
  positioning_id: string
  notes: string
}

export function AddInteractionDialog({ initialProspectId, trigger }: AddInteractionDialogProps) {
  const { t } = useTranslation()
  const { lastProspectId, getLastPositioningForStage, saveContext } = useLastInteractionContext()

  const [open, setOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: vineResolver(createInteractionSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      prospect_id: initialProspectId ?? lastProspectId ?? '',
      positioning_id: 'none',
      notes: '',
    },
  })

  const selectedProspectId = watch('prospect_id')
  const selectedPositioningId = watch('positioning_id')

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
    { enabled: open && !!selectedProspect?.funnelStageId },
  )
  const positionings = positioningsData?.data ?? []

  // Pre-fill last used positioning for this funnel stage once positionings load or dialog re-opens
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only run when positionings load or open changes, not on every selectedPositioningId change
  useEffect(() => {
    if (
      !open ||
      positioningsLoading ||
      selectedPositioningId !== 'none' ||
      !selectedProspect?.funnelStageId
    )
      return
    const lastId = getLastPositioningForStage(selectedProspect.funnelStageId)
    if (!lastId) return
    const found = positionings.find((p) => p.id === lastId)
    if (found) {
      setValue('positioning_id', lastId)
    }
  }, [positioningsLoading, positionings, selectedProspect?.funnelStageId, open])

  function onSubmit(values: FormValues) {
    setApiError(null)
    create.mutate(
      {
        prospect_id: values.prospect_id,
        positioning_id: values.positioning_id === 'none' ? null : values.positioning_id,
        notes: values.notes || null,
      },
      {
        onSuccess: () => {
          saveContext(values.prospect_id, selectedProspect?.funnelStageId, values.positioning_id)
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
    reset({ prospect_id: initialProspectId ?? '', positioning_id: 'none', notes: '' })
    setApiError(null)
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) resetAll()
    setOpen(newOpen)
  }

  // Changing prospect invalidates the previously picked positioning (filtered by stage)
  function handleProspectChange() {
    setValue('positioning_id', 'none')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" /> {t('interactions.addInteraction')}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{t('interactions.createForm.title')}</DialogTitle>
          <DialogDescription>{t('interactions.createForm.description')}</DialogDescription>
        </DialogHeader>

        <form id="create-interaction-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Prospect — required */}
          <ComboboxField
            control={control}
            name="prospect_id"
            id="interaction-prospect"
            label={t('interactions.fields.prospect')}
            required
            loading={prospectsLoading}
            placeholder={t('interactions.placeholders.selectProspect')}
            description={currentStage?.name}
            onValueChange={handleProspectChange}
            options={prospects.map((p) => ({ value: p.id, label: p.name }))}
          />

          {/* Positioning — optional, filtered by prospect's funnel stage */}
          <ComboboxField
            control={control}
            name="positioning_id"
            id="interaction-positioning"
            label={t('interactions.fields.positioning')}
            disabled={!selectedProspect}
            loading={positioningsLoading && !!selectedProspect}
            placeholder={t('interactions.placeholders.selectPositioning')}
            options={[
              { value: 'none', label: t('interactions.noPositioning') },
              ...positionings.map((pos) => ({ value: pos.id, label: pos.name })),
            ]}
          />

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
