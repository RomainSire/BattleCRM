import type { InteractionStatus, InteractionType } from '@battlecrm/shared'
import { vineResolver } from '@hookform/resolvers/vine'
import { Archive, ChevronRight, Pencil, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { i18nMessagesProvider } from '@/lib/validation'
import {
  useArchiveInteraction,
  useRestoreInteraction,
  useUpdateInteraction,
} from '../hooks/useInteractionMutations'
import { updateInteractionSchema } from '../schemas/interaction'
import { StatusIcon } from './StatusIcon'

export interface TimelineItemProps {
  interaction: InteractionType
  isExpanded: boolean
  onToggle: () => void
}

interface EditFormValues {
  notes: string
}

export function TimelineItem({ interaction, isExpanded, onToggle }: TimelineItemProps) {
  const { t } = useTranslation()
  const isArchived = interaction.deletedAt !== null
  const [isEditing, setIsEditing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<InteractionStatus>(interaction.status)
  const [editPositioningId, setEditPositioningId] = useState<string>(
    interaction.positioningId ?? 'none',
  )
  const [editDate, setEditDate] = useState<string>(interaction.interactionDate.slice(0, 10))

  const update = useUpdateInteraction()
  const archive = useArchiveInteraction()
  const restore = useRestoreInteraction()

  const { data: positioningsData, isLoading: positioningsLoading } = usePositionings(
    { funnel_stage_id: interaction.prospectFunnelStageId },
    { enabled: isEditing },
  )
  const positionings = positioningsData?.data ?? []

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: vineResolver(updateInteractionSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: { notes: interaction.notes ?? '' },
  })

  // Exit edit mode when item collapses
  useEffect(() => {
    if (!isExpanded) {
      setIsEditing(false)
      setApiError(null)
      setArchiveError(null)
      setRestoreError(null)
    }
  }, [isExpanded])

  // Sync form values when interaction data refreshes after a save
  useEffect(() => {
    if (!isEditing) {
      reset({ notes: interaction.notes ?? '' })
      setEditStatus(interaction.status)
      setEditPositioningId(interaction.positioningId ?? 'none')
      setEditDate(interaction.interactionDate.slice(0, 10))
    }
  }, [interaction, isEditing, reset])

  function handleEditStart() {
    reset({ notes: interaction.notes ?? '' })
    setEditStatus(interaction.status)
    setEditPositioningId(interaction.positioningId ?? 'none')
    setEditDate(interaction.interactionDate.slice(0, 10))
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
        id: interaction.id,
        payload: {
          status: editStatus,
          positioning_id: editPositioningId === 'none' ? null : editPositioningId,
          notes: values.notes.trim() || null,
          interaction_date: editDate || undefined,
        },
      },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success(t('interactions.toast.updated'))
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setApiError(message ?? t('interactions.toast.updateFailed'))
        },
      },
    )
  }

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className={cn(
          'flex w-full items-start gap-3 rounded px-1 py-1 text-left text-sm hover:bg-muted/50',
          isArchived && 'opacity-60',
        )}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'mt-0.5 size-3 shrink-0 text-muted-foreground transition-transform duration-200',
            isExpanded && 'rotate-90',
          )}
        />
        <StatusIcon status={interaction.status} className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className={cn('text-muted-foreground text-xs', isArchived && 'line-through')}>
            {new Date(interaction.interactionDate).toLocaleDateString()}
            {interaction.positioningName && <> · {interaction.positioningName}</>}
          </span>
          {interaction.notes && (
            <p className={cn('text-sm', !isExpanded && 'line-clamp-2')}>{interaction.notes}</p>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="ml-7 mt-1 mb-2 rounded bg-muted/30 px-3 py-2 text-xs space-y-3">
          {isEditing ? (
            /* ── EDIT MODE ── */
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              {/* Status */}
              <div className="flex flex-col gap-1">
                <Label className="text-xs">
                  {t('interactions.fields.status')}{' '}
                  <span aria-hidden="true" className="text-destructive">
                    *
                  </span>
                </Label>
                <ToggleGroup
                  type="single"
                  value={editStatus}
                  onValueChange={(v) => {
                    if (v) setEditStatus(v as InteractionStatus)
                  }}
                  className="justify-start"
                >
                  <ToggleGroupItem value="positive" aria-label={t('interactions.status.positive')}>
                    <StatusIcon status="positive" className="size-4" withLabel />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="pending" aria-label={t('interactions.status.pending')}>
                    <StatusIcon status="pending" className="size-4" withLabel />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="negative" aria-label={t('interactions.status.negative')}>
                    <StatusIcon status="negative" className="size-4" withLabel />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Positioning */}
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t('interactions.fields.positioning')}</Label>
                {positioningsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select
                    value={editPositioningId}
                    onValueChange={setEditPositioningId}
                    disabled={update.isPending}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('interactions.noPositioning')}</SelectItem>
                      {positionings.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Date */}
              <div className="flex flex-col gap-1">
                <Label htmlFor={`tl-edit-date-${interaction.id}`} className="text-xs">
                  {t('interactions.detail.date')}
                </Label>
                <input
                  id={`tl-edit-date-${interaction.id}`}
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  disabled={update.isPending}
                  className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <Label htmlFor={`tl-edit-notes-${interaction.id}`} className="text-xs">
                  {t('interactions.fields.notes')}
                </Label>
                <Textarea
                  id={`tl-edit-notes-${interaction.id}`}
                  {...register('notes')}
                  rows={3}
                  disabled={update.isPending}
                />
                <FieldError errors={[errors.notes]} />
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
            /* ── READ-ONLY MODE ── */
            <>
              {isArchived ? (
                /* Archived — Restore only */
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={restore.isPending}
                    onClick={() => {
                      setRestoreError(null)
                      restore.mutate(interaction.id, {
                        onSuccess: () => toast.success(t('interactions.toast.restored')),
                        onError: (error) => {
                          const message =
                            error instanceof ApiError ? error.errors[0]?.message : undefined
                          setRestoreError(message ?? t('interactions.toast.restoreFailed'))
                        },
                      })
                    }}
                  >
                    <RotateCcw className="size-4" />
                    {t('interactions.restore')}
                  </Button>
                  {restoreError && <p className="text-xs text-destructive">{restoreError}</p>}
                </div>
              ) : (
                /* Active — Edit + Archive */
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={handleEditStart}>
                    <Pencil className="size-4" />
                    {t('interactions.edit')}
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
                        {t('interactions.archive')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('interactions.archiveDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('interactions.archiveDialog.description')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            setArchiveError(null)
                            archive.mutate(interaction.id, {
                              onSuccess: () => toast.success(t('interactions.toast.archived')),
                              onError: (error) => {
                                const message =
                                  error instanceof ApiError ? error.errors[0]?.message : undefined
                                setArchiveError(message ?? t('interactions.toast.archiveFailed'))
                              },
                            })
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          disabled={archive.isPending}
                        >
                          {t('interactions.archiveDialog.confirm')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  {archiveError && <p className="text-xs text-destructive">{archiveError}</p>}
                </div>
              )}

              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                <span className="text-muted-foreground">{t('interactions.detail.date')}</span>
                <span>{new Date(interaction.interactionDate).toLocaleString()}</span>

                <span className="text-muted-foreground">
                  {t('interactions.detail.positioning')}
                </span>
                <span>{interaction.positioningName ?? t('interactions.noPositioning')}</span>
              </div>

              {interaction.notes ? (
                <div className="pt-1">
                  <p className="text-muted-foreground mb-0.5">{t('interactions.fields.notes')}</p>
                  <p className="whitespace-pre-wrap">{interaction.notes}</p>
                </div>
              ) : (
                <p className="text-muted-foreground italic">—</p>
              )}
            </>
          )}
        </div>
      )}
    </li>
  )
}
