import { vineResolver } from '@hookform/resolvers/vine'
import { Archive, ChevronRight, Pencil, RotateCcw, X } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { i18nMessagesProvider } from '@/lib/validation'
import {
  useArchiveProspect,
  useRestoreProspect,
  useUpdateProspect,
} from '../hooks/useProspectMutations'
import type { ProspectType } from '../lib/api'
import { updateProspectSchema } from '../schemas/prospect'

interface ProspectRowProps {
  prospect: ProspectType
  stageName: string | undefined
  isExpanded: boolean
  onToggle: () => void
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

export function ProspectRow({ prospect, stageName, isExpanded, onToggle }: ProspectRowProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const update = useUpdateProspect()
  const archive = useArchiveProspect()
  const restore = useRestoreProspect()

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

  const hasDetails = !!(
    prospect.company ||
    prospect.linkedinUrl ||
    prospect.email ||
    prospect.phone ||
    prospect.title ||
    prospect.notes
  )

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
    <article className="border-b last:border-b-0">
      {/* Collapsed row — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-accent',
          isArchived && 'opacity-60',
        )}
        aria-expanded={isExpanded}
        aria-controls={`prospect-panel-${prospect.id}`}
      >
        <ChevronRight
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition',
            isExpanded ? 'rotate-90' : '',
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-medium',
            isArchived && 'line-through text-muted-foreground',
          )}
        >
          {prospect.name}
        </span>
        <span className="w-40 shrink-0 truncate text-sm text-muted-foreground">
          {prospect.company ?? '—'}
        </span>
        <span className="w-40 shrink-0 truncate text-sm">
          {isArchived ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {t('prospects.archived')}
            </span>
          ) : (
            (stageName ?? '—')
          )}
        </span>
        <span className="w-48 shrink-0 truncate text-sm text-muted-foreground">
          {prospect.email ?? '—'}
        </span>
      </button>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div
          id={`prospect-panel-${prospect.id}`}
          className="space-y-2 border-t bg-muted/30 px-4 py-4"
        >
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
                {hasDetails && (
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    {prospect.company && (
                      <>
                        <dt className="text-muted-foreground">{t('prospects.fields.company')}</dt>
                        <dd>{prospect.company}</dd>
                      </>
                    )}
                    {prospect.linkedinUrl && (
                      <>
                        <dt className="text-muted-foreground">
                          {t('prospects.fields.linkedinUrl')}
                        </dt>
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
                  </dl>
                )}
                {/* Interactions — Epic 5 */}
                <p className="mt-4 text-xs italic text-muted-foreground">
                  {t('prospects.interactionsComingSoon')}
                </p>
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
      )}
    </article>
  )
}
