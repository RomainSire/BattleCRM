import type { InteractionType } from '@battlecrm/shared'
import { vineResolver } from '@hookform/resolvers/vine'
import { useEffect, useState } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { usePositionings } from '@/features/positionings/hooks/usePositionings'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { updateInteractionSchema } from '../schemas/interaction'
import { useDeleteInteraction, useUpdateInteraction } from './useInteractionMutations'

export interface EditFormValues {
  notes: string
}

export function useInteractionEdit(interaction: InteractionType, isExpanded: boolean) {
  const { t } = useTranslation()

  const [isEditing, setIsEditing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editPositioningId, setEditPositioningId] = useState<string>(
    interaction.positioningId ?? 'none',
  )
  const [editDate, setEditDate] = useState<string>(interaction.interactionDate.slice(0, 10))

  const update = useUpdateInteraction()
  const deleteInteraction = useDeleteInteraction()

  const { data: positioningsData, isLoading: positioningsLoading } = usePositionings(
    { funnel_stage_id: interaction.prospectFunnelStageId },
    { enabled: isEditing },
  )
  const positionings = positioningsData?.data ?? []

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors },
  } = useForm<EditFormValues>({
    resolver: vineResolver(updateInteractionSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: { notes: interaction.notes ?? '' },
  })

  // Exit edit mode when item collapses
  useEffect(() => {
    if (!isExpanded) {
      setIsEditing(false)
      setApiError(null)
      setDeleteError(null)
    }
  }, [isExpanded])

  // Sync form values when interaction data refreshes after a save
  useEffect(() => {
    if (!isEditing) {
      reset({ notes: interaction.notes ?? '' })
      setEditPositioningId(interaction.positioningId ?? 'none')
      setEditDate(interaction.interactionDate.slice(0, 10))
    }
  }, [interaction, isEditing, reset])

  function handleEditStart() {
    reset({ notes: interaction.notes ?? '' })
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

  const onSubmit: SubmitHandler<EditFormValues> = (values) => {
    setApiError(null)
    update.mutate(
      {
        id: interaction.id,
        payload: {
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

  function handleDelete() {
    setDeleteError(null)
    deleteInteraction.mutate(interaction.id, {
      onSuccess: () => toast.success(t('interactions.toast.deleted')),
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setDeleteError(message ?? t('interactions.toast.deleteFailed'))
      },
    })
  }

  return {
    // Mode
    isEditing,
    // Errors
    apiError,
    deleteError,
    // Edit fields
    editPositioningId,
    setEditPositioningId,
    editDate,
    setEditDate,
    // Mutations (expose isPending for button disabled states)
    update,
    deleteInteraction,
    // Positionings for positioning selector
    positionings,
    positioningsLoading,
    // Form
    register,
    formErrors,
    onFormSubmit: handleSubmit(onSubmit),
    // Handlers
    handleEditStart,
    handleCancel,
    handleDelete,
  }
}
