import type { PositioningType } from '@battlecrm/shared'
import { vineResolver } from '@hookform/resolvers/vine'
import { Pencil, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { useUpdatePositioning } from '../hooks/usePositioningMutations'
import { usePositioningProspects } from '../hooks/usePositioningProspects'
import { updatePositioningSchema } from '../schemas/positioning'

interface PositioningRowProps {
  positioning: PositioningType
  isOpen: boolean
}

interface EditFormValues {
  name: string
  description: string
  content: string
}

export function PositioningRow({ positioning, isOpen }: PositioningRowProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [editStageId, setEditStageId] = useState<string>(positioning.funnelStageId)

  // Fix #2: lazy — only fetch prospects when the row is open
  const { data: prospectsData, isLoading: prospectsLoading } = usePositioningProspects(
    positioning.id,
    { enabled: isOpen },
  )
  const linkedProspects = prospectsData?.data ?? []

  // Fix #3: also track loading + error state for stages
  const { data: stagesData, isLoading: stagesLoading, isError: stagesError } = useFunnelStages()
  const stages = stagesData?.data ?? []

  const update = useUpdatePositioning()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: vineResolver(updatePositioningSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      name: positioning.name,
      description: positioning.description ?? '',
      content: positioning.content ?? '',
    },
  })

  // Fix #1: exit edit mode when the accordion row is collapsed
  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false)
      setApiError(null)
    }
  }, [isOpen])

  // Reset form when positioning prop updates after a successful save
  useEffect(() => {
    if (!isEditing) {
      reset({
        name: positioning.name,
        description: positioning.description ?? '',
        content: positioning.content ?? '',
      })
      setEditStageId(positioning.funnelStageId)
    }
  }, [positioning, isEditing, reset])

  function handleEditStart() {
    reset({
      name: positioning.name,
      description: positioning.description ?? '',
      content: positioning.content ?? '',
    })
    setEditStageId(positioning.funnelStageId)
    setApiError(null)
    setIsEditing(true)
  }

  function handleCancel() {
    reset()
    setApiError(null)
    setIsEditing(false)
  }

  function onSubmit(values: EditFormValues) {
    setApiError(null)
    update.mutate(
      {
        id: positioning.id,
        name: values.name.trim(),
        funnel_stage_id: editStageId,
        description: values.description.trim() || null,
        content: values.content.trim() || null,
      },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success(t('positionings.toast.updated'))
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setApiError(message ?? t('positionings.toast.updateFailed'))
        },
      },
    )
  }

  return (
    <AccordionItem value={positioning.id}>
      <AccordionTrigger className="items-center px-4 py-3 hover:bg-accent hover:no-underline">
        <span className="min-w-0 flex-1 truncate font-medium">{positioning.name}</span>
        <span className="w-40 shrink-0">
          <Badge variant="secondary">{positioning.funnelStageName}</Badge>
        </span>
        <span className="w-64 shrink-0 truncate text-sm text-muted-foreground">
          {positioning.description ?? '—'}
        </span>
      </AccordionTrigger>

      <AccordionContent className="p-0">
        <div className="space-y-4 border-t bg-muted/30 px-4 py-4">
          {isEditing ? (
            /* ── EDIT MODE ── */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              {/* Name — required */}
              <div className="flex flex-col gap-1">
                <Label htmlFor={`edit-name-${positioning.id}`}>
                  {t('positionings.fields.name')}{' '}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </Label>
                {/* Fix #5: disabled during pending */}
                <Input
                  id={`edit-name-${positioning.id}`}
                  {...register('name')}
                  autoFocus
                  disabled={update.isPending}
                />
                <FieldError errors={[errors.name]} />
              </div>

              {/* Funnel Stage — required (Fix #3: loading + error states) */}
              {stagesError ? (
                <p className="text-xs text-destructive">{t('funnelStages.loadError')}</p>
              ) : stagesLoading ? (
                <div className="flex flex-col gap-1">
                  <Label>
                    {t('positionings.fields.funnelStage')}{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </Label>
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : stages.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <Label htmlFor={`edit-stage-${positioning.id}`}>
                    {t('positionings.fields.funnelStage')}{' '}
                    <span aria-hidden="true" className="text-destructive">
                      *
                    </span>
                  </Label>
                  {/* Fix #5: disabled during pending */}
                  <Select
                    value={editStageId}
                    onValueChange={setEditStageId}
                    disabled={update.isPending}
                  >
                    <SelectTrigger id={`edit-stage-${positioning.id}`} className="w-full">
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
                </div>
              ) : null}

              {/* Description — optional (Fix #4: placeholder, Fix #5: disabled) */}
              <div className="flex flex-col gap-1">
                <Label htmlFor={`edit-description-${positioning.id}`}>
                  {t('positionings.fields.description')}
                </Label>
                <Textarea
                  id={`edit-description-${positioning.id}`}
                  {...register('description')}
                  placeholder={t('positionings.placeholders.description')}
                  rows={2}
                  disabled={update.isPending}
                />
              </div>

              {/* Content — optional (Fix #4: placeholder, Fix #5: disabled) */}
              <div className="flex flex-col gap-1">
                <Label htmlFor={`edit-content-${positioning.id}`}>
                  {t('positionings.fields.content')}
                </Label>
                <Textarea
                  id={`edit-content-${positioning.id}`}
                  {...register('content')}
                  placeholder={t('positionings.placeholders.content')}
                  rows={4}
                  disabled={update.isPending}
                />
              </div>

              {/* API error */}
              <FieldError>{apiError}</FieldError>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={update.isPending}>
                  {update.isPending ? '...' : t('common.save')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={handleCancel}>
                  <X className="size-4" />
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          ) : (
            /* ── READ-ONLY MODE ── */
            <>
              {/* Edit button */}
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleEditStart}>
                  <Pencil className="size-4" />
                  {t('positionings.edit')}
                </Button>
              </div>

              {/* Details */}
              <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t('positionings.fields.funnelStage')}</dt>
                <dd>
                  <Badge variant="secondary">{positioning.funnelStageName}</Badge>
                </dd>

                <dt className="text-muted-foreground">{t('positionings.fields.description')}</dt>
                <dd className="whitespace-pre-wrap">
                  {positioning.description ?? (
                    <span className="italic text-muted-foreground">—</span>
                  )}
                </dd>

                <dt className="text-muted-foreground">{t('positionings.fields.content')}</dt>
                <dd className="whitespace-pre-wrap">
                  {positioning.content ?? <span className="italic text-muted-foreground">—</span>}
                </dd>
              </dl>

              {/* Linked prospects */}
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t('positionings.linkedProspects.title')}
                </p>
                {prospectsLoading ? (
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ) : linkedProspects.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">
                    {t('positionings.linkedProspects.empty')}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {linkedProspects.map((prospect) => (
                      <li key={prospect.id} className="text-sm">
                        <span className="font-medium">{prospect.name}</span>
                        {prospect.company && (
                          <span className="ml-2 text-muted-foreground">— {prospect.company}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Interactions — placeholder for Epic 5 */}
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {t('positionings.interactions.title')}
                </p>
                <p className="text-xs italic text-muted-foreground">
                  {t('positionings.interactions.comingSoon')}
                </p>
              </div>
            </>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
