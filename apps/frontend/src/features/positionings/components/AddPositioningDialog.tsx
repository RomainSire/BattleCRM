import { vineResolver } from '@hookform/resolvers/vine'
import { Plus } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
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
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useCreatePositioning } from '../hooks/usePositioningMutations'
import { createPositioningSchema } from '../schemas/positioning'

interface FormValues {
  name: string
  description: string
  content: string
}

export function AddPositioningDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [selectedStageId, setSelectedStageId] = useState<string>('')

  const create = useCreatePositioning()
  const { data: stagesData, isLoading: stagesLoading } = useFunnelStages()
  const stages = stagesData?.data ?? []

  // Initialize selected stage to first stage when data loads
  useEffect(() => {
    if (stages.length > 0 && !selectedStageId) {
      setSelectedStageId(stages[0].id)
    }
  }, [stages, selectedStageId])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: vineResolver(createPositioningSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      name: '',
      description: '',
      content: '',
    },
  })

  function onSubmit(values: FormValues) {
    setApiError(null)
    const payload = {
      funnel_stage_id: selectedStageId,
      name: values.name.trim(),
      ...(values.description.trim() && { description: values.description.trim() }),
      ...(values.content.trim() && { content: values.content.trim() }),
    }
    create.mutate(payload, {
      onSuccess: () => {
        reset()
        setOpen(false)
        toast.success(t('positionings.toast.created'))
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setApiError(message ?? t('positionings.toast.createFailed'))
      },
    })
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      reset()
      setApiError(null)
      setSelectedStageId(stages[0]?.id ?? '')
    }
    setOpen(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('positionings.addPositioning')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('positionings.createForm.title')}</DialogTitle>
          <DialogDescription>{t('positionings.createForm.description')}</DialogDescription>
        </DialogHeader>

        <form id="create-positioning-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Name — required */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="positioning-name">
              {t('positionings.fields.name')}{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="positioning-name"
              {...register('name')}
              placeholder={t('positionings.placeholders.name')}
              autoFocus
            />
            <FieldError errors={[errors.name]} />
          </div>

          {/* Funnel Stage — required (Fix #6: show skeleton while loading) */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="positioning-stage">
              {t('positionings.fields.funnelStage')}{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            {stagesLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                <SelectTrigger id="positioning-stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Description — optional */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="positioning-description">{t('positionings.fields.description')}</Label>
            <Textarea
              id="positioning-description"
              {...register('description')}
              placeholder={t('positionings.placeholders.description')}
              rows={2}
            />
          </div>

          {/* Content — optional */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="positioning-content">{t('positionings.fields.content')}</Label>
            <Textarea
              id="positioning-content"
              {...register('content')}
              placeholder={t('positionings.placeholders.content')}
              rows={4}
            />
          </div>

          {/* API-level error */}
          <FieldError>{apiError}</FieldError>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="create-positioning-form"
            disabled={create.isPending || !selectedStageId}
          >
            {create.isPending ? '...' : t('positionings.createForm.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
