import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { vineResolver } from '@hookform/resolvers/vine'
import { Check, GripVertical, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { useDeleteFunnelStage, useUpdateFunnelStage } from '../hooks/useFunnelStages'
import type { FunnelStageType } from '../lib/api'
import { funnelStageSchema } from '../schemas/funnelStage'

type Props = {
  stage: FunnelStageType
  displayPosition: number
}

interface FormValues {
  name: string
}

export function FunnelStageItem({ stage, displayPosition }: Props) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  })
  const [isEditing, setIsEditing] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const update = useUpdateFunnelStage()
  const deleteMutation = useDeleteFunnelStage()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: vineResolver(funnelStageSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: { name: stage.name },
  })
  const nameValue = watch('name')

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  function handleEditStart() {
    reset({ name: stage.name })
    setUpdateError(null)
    setIsEditing(true)
  }

  function handleCancel() {
    reset({ name: stage.name })
    setIsEditing(false)
  }

  function onSubmit({ name }: FormValues) {
    const trimmed = name.trim()
    if (!trimmed || trimmed === stage.name) {
      setIsEditing(false)
      return
    }
    setUpdateError(null)
    update.mutate(
      { id: stage.id, name: trimmed },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success(t('funnelStages.toast.updated'))
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setUpdateError(message ?? t('funnelStages.toast.updateFailed'))
        },
      },
    )
  }

  function handleDelete() {
    setDeleteError(null)
    deleteMutation.mutate(stage.id, {
      onSuccess: () => {
        toast.success(t('funnelStages.toast.deleted'))
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setDeleteError(message ?? t('funnelStages.toast.deleteFailed'))
      },
    })
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-stage-name={stage.name}
      className="flex flex-col rounded-md border bg-card px-3 py-2"
    >
      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        <button
          type="button"
          aria-label={t('funnelStages.aria.reorder')}
          className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        {/* Position badge — reflects current visual order (updated optimistically on drag) */}
        <span className="w-6 text-center text-xs font-medium text-muted-foreground">
          {displayPosition}
        </span>

        {/* Name / inline edit */}
        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 items-center gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Input
                {...register('name')}
                autoFocus
                className="h-7 text-sm"
                aria-label={t('funnelStages.stageName')}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleCancel()
                }}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              {updateError && <p className="text-xs text-destructive">{updateError}</p>}
            </div>
            <Button
              type="submit"
              size="icon-sm"
              disabled={update.isPending || !nameValue.trim()}
              aria-label={t('funnelStages.aria.saveName')}
            >
              <Check className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={handleCancel}
              aria-label={t('funnelStages.aria.cancelEdit')}
            >
              <X className="size-4" />
            </Button>
          </form>
        ) : (
          <span className="flex-1 text-sm">{stage.name}</span>
        )}

        {/* Actions (hidden while editing) */}
        {!isEditing && (
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={handleEditStart}
              aria-label={t('funnelStages.aria.edit')}
            >
              <Pencil className="size-3" />
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('funnelStages.aria.delete')}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('funnelStages.deleteDialog.title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('funnelStages.deleteDialog.description', { name: stage.name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {t('funnelStages.deleteDialog.confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Delete error — shown inline when the API call fails after dialog confirmation */}
      {deleteError && <p className="mt-1 text-xs text-destructive">{deleteError}</p>}
    </div>
  )
}
