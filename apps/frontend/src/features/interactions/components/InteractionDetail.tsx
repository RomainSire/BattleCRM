import type { InteractionType } from '@battlecrm/shared'
import { X } from 'lucide-react'
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
import { formatDateTime } from '@/lib/dates'
import { useInteractionEdit } from '../hooks/useInteractionEdit'

interface Props {
  interaction: InteractionType
  onClose: () => void
}

export function InteractionDetail({ interaction, onClose }: Props) {
  const { t } = useTranslation()
  const {
    isEditing,
    apiError,
    deleteError,
    editPositioningId,
    setEditPositioningId,
    editDate,
    setEditDate,
    update,
    deleteInteraction,
    positionings,
    positioningsLoading,
    register,
    formErrors,
    onFormSubmit,
    handleEditStart,
    handleCancel,
    handleDelete,
  } = useInteractionEdit(interaction, true, { onDeleteSuccess: onClose })

  return (
    <div className="space-y-3 px-4 pb-4 text-sm">
      {isEditing ? (
        <form onSubmit={onFormSubmit} className="space-y-3">
          <div className="flex flex-col gap-1">
            <Label>{t('interactions.fields.positioning')}</Label>
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

          <div className="flex flex-col gap-1">
            <Label htmlFor={`edit-date-${interaction.id}`}>{t('interactions.detail.date')}</Label>
            <input
              id={`edit-date-${interaction.id}`}
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              disabled={update.isPending}
              className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={`edit-notes-${interaction.id}`}>{t('interactions.fields.notes')}</Label>
            <Textarea
              id={`edit-notes-${interaction.id}`}
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
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleEditStart}>
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

          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <span className="text-muted-foreground">{t('interactions.detail.date')}</span>
            <span>{formatDateTime(interaction.interactionDate)}</span>

            <span className="text-muted-foreground">{t('interactions.detail.positioning')}</span>
            <span>{interaction.positioningName ?? t('interactions.noPositioning')}</span>

            <span className="text-muted-foreground">{t('prospects.title')}</span>
            <span>{interaction.prospectName}</span>
          </div>

          {interaction.notes && (
            <div className="pt-1">
              <p className="mb-1 text-xs text-muted-foreground">{t('interactions.fields.notes')}</p>
              <p className="whitespace-pre-wrap">{interaction.notes}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
