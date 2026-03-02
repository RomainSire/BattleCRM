import { vineResolver } from '@hookform/resolvers/vine'
import { Archive, Pencil, Plus, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { ApiError } from '@/lib/api'
import { i18nMessagesProvider } from '@/lib/validation'
import {
  useArchiveProspect,
  useRestoreProspect,
  useUpdateProspect,
} from '../hooks/useProspectMutations'
import { useProspectStageTransitions } from '../hooks/useProspectStageTransitions'
import type { ProspectType } from '../lib/api'
import { updateProspectSchema } from '../schemas/prospect'

interface ProspectDetailProps {
  prospect: ProspectType
  onClose?: () => void
}

interface EditFormValues {
  name: string
  company: string
  linkedin_url: string
  email: string
  phone: string
  title: string
  notes: string
}

const EDIT_FIELDS = [
  ['company', 'company'],
  ['linkedin_url', 'linkedinUrl'],
  ['email', 'email'],
  ['title', 'title'],
] as const

export function ProspectDetail({ prospect, onClose }: ProspectDetailProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [stageError, setStageError] = useState<string | null>(null)
  const update = useUpdateProspect()
  const archive = useArchiveProspect()
  const restore = useRestoreProspect()

  const { data: stagesData } = useFunnelStages()
  const stages = stagesData?.data ?? []

  // Always enabled: component only mounts when visible (expanded row or open Drawer)
  const { data: transitionsData, isLoading: transitionsLoading } = useProspectStageTransitions(
    prospect.id,
    { enabled: true },
  )
  const transitions = transitionsData?.data ?? []

  const currentStageIndex = stages.findIndex((s) => s.id === prospect.funnelStageId)
  const stagePosition = currentStageIndex >= 0 ? currentStageIndex + 1 : null

  const isArchived = prospect.deletedAt !== null

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormValues>({
    resolver: vineResolver(updateProspectSchema, { messagesProvider: i18nMessagesProvider }),
    defaultValues: {
      name: prospect.name,
      company: prospect.company ?? '',
      linkedin_url: prospect.linkedinUrl ?? '',
      email: prospect.email ?? '',
      phone: prospect.phone ?? '',
      title: prospect.title ?? '',
      notes: prospect.notes ?? '',
    },
  })

  function handleEditStart() {
    reset({
      name: prospect.name,
      company: prospect.company ?? '',
      linkedin_url: prospect.linkedinUrl ?? '',
      email: prospect.email ?? '',
      phone: prospect.phone ?? '',
      title: prospect.title ?? '',
      notes: prospect.notes ?? '',
    })
    setApiError(null)
    setIsEditing(true)
  }

  function handleCancel() {
    reset()
    setApiError(null)
    setIsEditing(false)
  }

  function handleArchiveConfirm() {
    setArchiveError(null)
    archive.mutate(prospect.id, {
      onSuccess: () => {
        toast.success(t('prospects.toast.archived'))
        onClose?.()
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setArchiveError(message ?? t('prospects.toast.archiveFailed'))
      },
    })
  }

  function handleRestore() {
    setRestoreError(null)
    restore.mutate(prospect.id, {
      onSuccess: () => {
        toast.success(t('prospects.toast.restored'))
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setRestoreError(message ?? t('prospects.toast.restoreFailed'))
      },
    })
  }

  function handleStageChange(newStageId: string) {
    setStageError(null)
    update.mutate(
      { id: prospect.id, funnel_stage_id: newStageId },
      {
        onSuccess: () => {
          toast.success(t('prospects.toast.stageMoved'))
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setStageError(message ?? t('prospects.toast.stageMoveFailed'))
        },
      },
    )
  }

  function onSubmit(values: EditFormValues) {
    setApiError(null)
    update.mutate(
      {
        id: prospect.id,
        name: values.name.trim(),
        company: values.company.trim() || null,
        linkedin_url: values.linkedin_url.trim() || null,
        email: values.email.trim() || null,
        phone: values.phone.trim() || null,
        title: values.title.trim() || null,
        notes: values.notes.trim() || null,
      },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success(t('prospects.toast.updated'))
        },
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setApiError(message ?? t('prospects.toast.updateFailed'))
        },
      },
    )
  }

  return (
    <div className="space-y-2 px-4 py-4">
      {isEditing ? (
        /* ── EDIT MODE ── */
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* Name — required */}
          <div className="flex flex-col gap-1">
            <Label htmlFor={`edit-name-${prospect.id}`}>
              {t('prospects.fields.name')}{' '}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </Label>
            <Input id={`edit-name-${prospect.id}`} {...register('name')} autoFocus />
            <FieldError errors={[errors.name]} />
          </div>

          {/* Optional fields — 2-column grid */}
          <div className="grid grid-cols-2 gap-3">
            {EDIT_FIELDS.map(([field, labelKey]) => (
              <div key={field} className="flex flex-col gap-1">
                <Label htmlFor={`edit-${field}-${prospect.id}`}>
                  {t(`prospects.fields.${labelKey}`)}
                </Label>
                <Input
                  id={`edit-${field}-${prospect.id}`}
                  type={field === 'email' ? 'email' : 'text'}
                  {...register(field)}
                  placeholder={t(`prospects.placeholders.${labelKey}`)}
                />
                <FieldError errors={[errors[field]]} />
              </div>
            ))}
          </div>

          {/* Phone — PhoneInput with country selector */}
          <div className="flex flex-col gap-1">
            <Label htmlFor={`edit-phone-${prospect.id}`}>{t('prospects.fields.phone')}</Label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  id={`edit-phone-${prospect.id}`}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? '')}
                  defaultCountry="FR"
                  placeholder={t('prospects.placeholders.phone')}
                  searchPlaceholder={t('phoneInput.searchCountry')}
                  noCountryFound={t('phoneInput.noCountryFound')}
                />
              )}
            />
            <FieldError errors={[errors.phone]} />
          </div>

          {/* Notes — Textarea */}
          <div className="flex flex-col gap-1">
            <Label htmlFor={`edit-notes-${prospect.id}`}>{t('prospects.fields.notes')}</Label>
            <Textarea
              id={`edit-notes-${prospect.id}`}
              {...register('notes')}
              rows={3}
              placeholder={t('prospects.placeholders.notes')}
            />
          </div>

          {/* API error */}
          <FieldError>{apiError}</FieldError>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? '...' : t('common.save')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              aria-label={t('prospects.aria.cancelEdit')}
            >
              <X className="size-4" />
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : (
        /* ── READ-ONLY MODE ── */
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {prospect.company && (
                <>
                  <dt className="text-muted-foreground">{t('prospects.fields.company')}</dt>
                  <dd>{prospect.company}</dd>
                </>
              )}
              {prospect.linkedinUrl && (
                <>
                  <dt className="text-muted-foreground">{t('prospects.fields.linkedinUrl')}</dt>
                  <dd>
                    <a
                      href={
                        prospect.linkedinUrl.startsWith('https://') ||
                        prospect.linkedinUrl.startsWith('http://')
                          ? prospect.linkedinUrl
                          : '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-primary underline-offset-4 hover:underline"
                    >
                      {prospect.linkedinUrl}
                    </a>
                  </dd>
                </>
              )}
              {prospect.email && (
                <>
                  <dt className="text-muted-foreground">{t('prospects.fields.email')}</dt>
                  <dd>{prospect.email}</dd>
                </>
              )}
              {prospect.phone && (
                <>
                  <dt className="text-muted-foreground">{t('prospects.fields.phone')}</dt>
                  <dd>
                    <a
                      href={`tel:${prospect.phone}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {prospect.phone}
                    </a>
                  </dd>
                </>
              )}
              {prospect.title && (
                <>
                  <dt className="text-muted-foreground">{t('prospects.fields.title')}</dt>
                  <dd>{prospect.title}</dd>
                </>
              )}
              {prospect.notes && (
                <>
                  <dt className="text-muted-foreground">{t('prospects.fields.notes')}</dt>
                  <dd className="whitespace-pre-wrap">{prospect.notes}</dd>
                </>
              )}
              {/* Positioning — Epic 4 will replace with name via usePositioning hook */}
              <dt className="text-muted-foreground">{t('prospects.fields.positioning')}</dt>
              <dd>
                {prospect.positioningId ? (
                  <span>{t('prospects.positioningLinked')}</span>
                ) : (
                  <span className="italic text-muted-foreground">{t('prospects.notAssigned')}</span>
                )}
              </dd>
            </dl>
            {/* Stage management — active prospects only */}
            {!isArchived && (
              <div className="mt-4 flex flex-col gap-1">
                <Label htmlFor={`stage-select-${prospect.id}`}>
                  {t('prospects.fields.funnelStage')}
                  {stagePosition !== null && stages.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {t('prospects.stagePosition', {
                        current: stagePosition,
                        total: stages.length,
                      })}
                    </span>
                  )}
                </Label>
                <Select
                  value={prospect.funnelStageId}
                  onValueChange={handleStageChange}
                  disabled={update.isPending || stages.length === 0}
                >
                  <SelectTrigger
                    id={`stage-select-${prospect.id}`}
                    className="w-full"
                    aria-label={t('prospects.aria.stageSelect', { name: prospect.name })}
                  >
                    <SelectValue placeholder={t('prospects.fields.funnelStage')} />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {stageError && <p className="text-xs text-destructive">{stageError}</p>}
              </div>
            )}

            {/* Stage History */}
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {t('prospects.stageHistory')}
              </p>
              {transitionsLoading ? (
                <p className="text-xs italic text-muted-foreground">...</p>
              ) : transitions.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  {t('prospects.noStageHistory')}
                </p>
              ) : (
                <ul className="space-y-1">
                  {transitions.map((tr) => (
                    <li
                      key={tr.id}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span>{new Date(tr.transitionedAt).toLocaleString()}</span>
                      <span>—</span>
                      <span>
                        {tr.fromStageName ?? t('prospects.initialStage')}
                        {' → '}
                        {tr.toStageName}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Interactions — active prospects only; Epic 5 implements the form and timeline */}
            {!isArchived && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('prospects.interactions.title')}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled
                    aria-label={`${t('prospects.interactions.logButton')} — ${t('prospects.interactions.comingSoon')}`}
                  >
                    <Plus className="mr-1 size-3" />
                    {t('prospects.interactions.logButton')}
                  </Button>
                </div>
                <p className="text-xs italic text-muted-foreground">
                  {t('prospects.interactions.empty')}
                </p>
              </div>
            )}
          </div>

          {/* Actions: Edit (active only) + Archive/Restore */}
          <div className="flex shrink-0 flex-col items-end gap-1">
            {!isArchived && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={handleEditStart}
                aria-label={t('prospects.aria.editProspect', { name: prospect.name })}
              >
                <Pencil className="size-3" />
              </Button>
            )}
            {isArchived ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleRestore}
                disabled={restore.isPending}
                aria-label={t('prospects.aria.restoreProspect', { name: prospect.name })}
              >
                <RotateCcw className="size-3" />
                {t('prospects.restore')}
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label={t('prospects.aria.archiveProspect', { name: prospect.name })}
                  >
                    <Archive className="size-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('prospects.archiveDialog.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('prospects.archiveDialog.description', { name: prospect.name })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleArchiveConfirm}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t('prospects.archiveDialog.confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {archiveError && <p className="text-xs text-destructive">{archiveError}</p>}
            {restoreError && <p className="text-xs text-destructive">{restoreError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
