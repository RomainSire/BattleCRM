import type { InteractionStatus, InteractionType } from '@battlecrm/shared'
import { vineResolver } from '@hookform/resolvers/vine'
import { useEffect, useState } from 'react'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { usePositionings } from '@/features/positionings/hooks/usePositionings'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import { updateInteractionSchema } from '../schemas/interaction'
import {
  useArchiveInteraction,
  useRestoreInteraction,
  useUpdateInteraction,
} from './useInteractionMutations'

export interface EditFormValues {
  notes: string
}

export function useInteractionEdit(interaction: InteractionType, isExpanded: boolean) {
  const { t } = useTranslation()

  const [isEditing, setIsEditing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<InteractionStatus>(interaction.status)
  const [editPositioningId, setEditPositioningId] = useState<string>(
    interaction.positioningId ?? 'none',
  )
  const [editDate, setEditDate] = useState<string>(interaction.interactionDate.slice(0, 10))

  const isArchived = interaction.deletedAt !== null
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

  const onSubmit: SubmitHandler<EditFormValues> = (values) => {
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

  function handleArchive() {
    setArchiveError(null)
    archive.mutate(interaction.id, {
      onSuccess: () => toast.success(t('interactions.toast.archived')),
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setArchiveError(message ?? t('interactions.toast.archiveFailed'))
      },
    })
  }

  function handleRestore() {
    setRestoreError(null)
    restore.mutate(interaction.id, {
      onSuccess: () => toast.success(t('interactions.toast.restored')),
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setRestoreError(message ?? t('interactions.toast.restoreFailed'))
      },
    })
  }

  return {
    // Mode
    isEditing,
    isArchived,
    // Errors
    apiError,
    archiveError,
    restoreError,
    // Edit fields
    editStatus,
    setEditStatus,
    editPositioningId,
    setEditPositioningId,
    editDate,
    setEditDate,
    // Mutations (expose isPending for button disabled states)
    update,
    archive,
    restore,
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
    handleArchive,
    handleRestore,
  }
}
