import type { InteractionType } from '@battlecrm/shared'
import { Archive, ChevronRight, Pencil, RotateCcw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { cn } from '@/lib/utils'
import { useInteractionEdit } from '../hooks/useInteractionEdit'
import { StatusIcon } from './StatusIcon'

export interface TimelineItemProps {
  interaction: InteractionType
  isExpanded: boolean
  onToggle: () => void
}

export function TimelineItem({ interaction, isExpanded, onToggle }: TimelineItemProps) {
  const { t } = useTranslation()
  const {
    isEditing,
    isArchived,
    apiError,
    archiveError,
    restoreError,
    editStatus,
    setEditStatus,
    editPositioningId,
    setEditPositioningId,
    editDate,
    setEditDate,
    update,
    archive,
    positionings,
    positioningsLoading,
    register,
    formErrors,
    onFormSubmit,
    handleEditStart,
    handleCancel,
    handleArchive,
    handleRestore,
  } = useInteractionEdit(interaction, isExpanded)

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
        <div className="mb-2 ml-7 mt-1 space-y-3 rounded bg-muted/30 px-3 py-2 text-xs">
          {isEditing ? (
            /* ── EDIT MODE ── */
            <form onSubmit={onFormSubmit} className="space-y-3">
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
                    if (v) setEditStatus(v as typeof editStatus)
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
                <FieldError errors={[formErrors.notes]} />
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
                    disabled={archive.isPending}
                    onClick={handleRestore}
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
                          onClick={handleArchive}
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
                  <p className="mb-0.5 text-muted-foreground">{t('interactions.fields.notes')}</p>
                  <p className="whitespace-pre-wrap">{interaction.notes}</p>
                </div>
              ) : (
                <p className="italic text-muted-foreground">—</p>
              )}
            </>
          )}
        </div>
      )}
    </li>
  )
}
