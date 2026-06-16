import type { PositioningType } from '@battlecrm/shared'
import { vineResolver } from '@hookform/resolvers/vine'
import { Archive, Pencil, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectField } from '@/components/ui/select-field'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { TimelineItem } from '@/features/interactions/components/TimelineItem'
import { useInteractions } from '@/features/interactions/hooks/useInteractions'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import {
  useArchivePositioning,
  useRestorePositioning,
  useUpdatePositioning,
} from '../hooks/usePositioningMutations'
import { usePositioningProspects } from '../hooks/usePositioningProspects'
import { updatePositioningSchema } from '../schemas/positioning'

interface Props {
  positioning: PositioningType
  onClose: () => void
}

interface EditFormValues {
  name: string
  funnel_stage_id: string
  description: string
  content: string
}

export function PositioningDetail({ positioning, onClose }: Props) {
  const { t } = useTranslation()
  const isArchived = positioning.deletedAt !== null
  const [isEditing, setIsEditing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [expandedInteractionId, setExpandedInteractionId] = useState<string | null>(null)

  const {
    data: prospectsData,
    isLoading: prospectsLoading,
    isError: prospectsError,
  } = usePositioningProspects(positioning.id)

  const {
    data: interactionsData,
    isLoading: interactionsLoading,
    isError: interactionsError,
  } = useInteractions({ positioning_id: positioning.id })

  const linkedProspects = prospectsData?.data ?? []

  const { data: stagesData, isLoading: stagesLoading, isError: stagesError } = useFunnelStages()
  const stages = stagesData?.data ?? []

  const update = useUpdatePositioning()
  const archive = useArchivePositioning()
  const restore = useRestorePositioning()

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: vineResolver(updatePositioningSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      name: positioning.name,
      funnel_stage_id: positioning.funnelStageId,
      description: positioning.description ?? '',
      content: positioning.content ?? '',
    },
  })

  useEffect(() => {
    if (!isEditing) {
      reset({
        name: positioning.name,
        funnel_stage_id: positioning.funnelStageId,
        description: positioning.description ?? '',
        content: positioning.content ?? '',
      })
    }
  }, [positioning, isEditing, reset])

  function handleEditStart() {
    reset({
      name: positioning.name,
      funnel_stage_id: positioning.funnelStageId,
      description: positioning.description ?? '',
      content: positioning.content ?? '',
    })
    setApiError(null)
    setArchiveError(null)
    setIsEditing(true)
  }

  function handleCancel() {
    reset()
    setApiError(null)
    setIsEditing(false)
  }

  function handleArchiveConfirm() {
    setArchiveError(null)
    archive.mutate(positioning.id, {
      onSuccess: () => {
        toast.success(t('positionings.toast.archived'))
        onClose()
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setArchiveError(message ?? t('positionings.toast.archiveFailed'))
      },
    })
  }

  function handleRestoreConfirm() {
    setRestoreError(null)
    restore.mutate(positioning.id, {
      onSuccess: () => {
        toast.success(t('positionings.toast.restored'))
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setRestoreError(message ?? t('positionings.toast.restoreFailed'))
      },
    })
  }

  function onSubmit(values: EditFormValues) {
    setApiError(null)
    update.mutate(
      {
        id: positioning.id,
        name: values.name.trim(),
        funnel_stage_id: values.funnel_stage_id,
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
    <div className="space-y-4 px-4 pb-4">
      {isEditing ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`edit-name-${positioning.id}`}>
              {t('positionings.fields.name')}{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id={`edit-name-${positioning.id}`}
              {...register('name')}
              autoFocus
              disabled={update.isPending}
            />
            <FieldError errors={[errors.name]} />
          </div>

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
            <SelectField
              control={control}
              name="funnel_stage_id"
              id={`edit-stage-${positioning.id}`}
              label={t('positionings.fields.funnelStage')}
              required
              disabled={update.isPending}
              options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
            />
          ) : null}

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

          <FieldError>{apiError}</FieldError>

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
        <>
          {!isArchived && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleEditStart}>
                  <Pencil className="size-4" />
                  {t('positionings.edit')}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={archive.isPending}
                    >
                      <Archive className="size-4" />
                      {t('positionings.archive')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('positionings.archiveDialog.title')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('positionings.archiveDialog.description', { name: positioning.name })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleArchiveConfirm}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={archive.isPending}
                      >
                        {t('positionings.archiveDialog.confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {archiveError && <p className="text-xs text-destructive">{archiveError}</p>}
            </>
          )}

          {isArchived && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRestoreConfirm}
                disabled={restore.isPending}
              >
                <RotateCcw className="size-4" />
                {t('positionings.restore')}
              </Button>
              {restoreError && <p className="text-xs text-destructive">{restoreError}</p>}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('positionings.fields.funnelStage')}</dt>
            <dd>
              <Badge variant="secondary">{positioning.funnelStageName}</Badge>
            </dd>

            <dt className="text-muted-foreground">{t('positionings.fields.description')}</dt>
            <dd className="whitespace-pre-wrap">
              {positioning.description ?? <span className="italic text-muted-foreground">—</span>}
            </dd>

            <dt className="text-muted-foreground">{t('positionings.fields.content')}</dt>
            <dd className="whitespace-pre-wrap">
              {positioning.content ?? <span className="italic text-muted-foreground">—</span>}
            </dd>
          </dl>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t('positionings.linkedProspects.title')}
            </p>
            {prospectsLoading ? (
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : prospectsError ? (
              <p className="text-xs text-destructive">
                {t('positionings.linkedProspects.loadError')}
              </p>
            ) : linkedProspects.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                {t('positionings.linkedProspects.empty')}
              </p>
            ) : (
              <ul className="space-y-1">
                {linkedProspects.map((prospect) => (
                  <li key={prospect.id} className="text-sm">
                    <Link
                      to="/prospects"
                      className="text-primary underline-offset-4 hover:underline"
                      aria-label={t('positionings.aria.viewProspect', { name: prospect.name })}
                    >
                      <span className="font-medium">{prospect.name}</span>
                      {prospect.company && (
                        <span className="text-muted-foreground"> - {prospect.company}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t('positionings.interactions.title')}
            </p>
            {interactionsLoading ? (
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : interactionsError ? (
              <p className="text-xs text-destructive">{t('positionings.interactions.loadError')}</p>
            ) : (interactionsData?.data ?? []).length === 0 ? (
              <p className="text-xs italic text-muted-foreground">
                {t('positionings.interactions.empty')}
              </p>
            ) : (
              <ul className="space-y-1">
                {(interactionsData?.data ?? []).map((interaction) => (
                  <TimelineItem
                    key={interaction.id}
                    interaction={interaction}
                    isExpanded={expandedInteractionId === interaction.id}
                    onToggle={() =>
                      setExpandedInteractionId((prev) =>
                        prev === interaction.id ? null : interaction.id,
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
