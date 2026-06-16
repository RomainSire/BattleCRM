import type { InteractionType } from '@battlecrm/shared'
import { ChevronRight, Pencil, Trash2, X } from 'lucide-react'
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
import { DateField } from '@/components/ui/date-field'
import { FieldError } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { SelectField } from '@/components/ui/select-field'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useInteractionEdit } from '../hooks/useInteractionEdit'

export interface TimelineItemProps {
  interaction: InteractionType
  isExpanded: boolean
  onToggle: () => void
}

export function TimelineItem({ interaction, isExpanded, onToggle }: TimelineItemProps) {
  const { t } = useTranslation()
  const {
    isEditing,
    apiError,
    deleteError,
    update,
    deleteInteraction,
    positionings,
    positioningsLoading,
    register,
    control,
    formErrors,
    onFormSubmit,
    handleEditStart,
    handleCancel,
    handleDelete,
  } = useInteractionEdit(interaction, isExpanded)

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-start gap-3 rounded px-1 py-1 text-left text-sm hover:bg-muted/50"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'mt-0.5 size-3 shrink-0 text-muted-foreground transition-transform duration-200',
            isExpanded && 'rotate-90',
          )}
        />
        <div className="min-w-0 flex-1">
          <span className="text-muted-foreground text-xs">
            {formatDate(interaction.interactionDate)}
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
              {/* Positioning */}
              <SelectField
                control={control}
                name="positioning_id"
                label={<span className="text-xs">{t('interactions.fields.positioning')}</span>}
                disabled={update.isPending}
                loading={positioningsLoading}
                options={[
                  { value: 'none', label: t('interactions.noPositioning') },
                  ...positionings.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />

              {/* Date */}
              <DateField
                control={control}
                name="interaction_date"
                id={`tl-edit-date-${interaction.id}`}
                label={t('interactions.detail.date')}
                labelClassName="text-xs"
                disabled={update.isPending}
                className="w-48"
              />

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
                      disabled={deleteInteraction.isPending}
                    >
                      <Trash2 className="size-4" />
                      {t('interactions.delete')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('interactions.deleteDialog.title')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('interactions.deleteDialog.description')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteInteraction.isPending}
                      >
                        {t('interactions.deleteDialog.confirm')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                <span className="text-muted-foreground">{t('interactions.detail.date')}</span>
                <span>{formatDateTime(interaction.interactionDate)}</span>

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
