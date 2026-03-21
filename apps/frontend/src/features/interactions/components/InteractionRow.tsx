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
import { Badge } from '@/components/ui/badge'
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
import { TableCell, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useInteractionEdit } from '../hooks/useInteractionEdit'
import { StatusIcon } from './StatusIcon'

interface InteractionRowProps {
  interaction: InteractionType
  isExpanded: boolean
  onToggle: () => void
}

export function InteractionRow({ interaction, isExpanded, onToggle }: InteractionRowProps) {
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

  const notesPreview = interaction.notes
    ? interaction.notes.length > 80
      ? `${interaction.notes.slice(0, 80)}…`
      : interaction.notes
    : '—'

  return (
    <>
      <TableRow
        onClick={onToggle}
        className={cn('cursor-pointer', isArchived && 'opacity-60')}
        aria-expanded={isExpanded}
      >
        <TableCell className="w-8 pr-0">
          <ChevronRight
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-90',
            )}
          />
        </TableCell>

        <TableCell className={cn('text-sm text-muted-foreground', isArchived && 'line-through')}>
          {new Date(interaction.interactionDate).toLocaleDateString()}
        </TableCell>

        <TableCell
          className={cn('font-medium', isArchived && 'line-through text-muted-foreground')}
        >
          {interaction.prospectName}
        </TableCell>

        <TableCell>
          {isArchived ? (
            <Badge variant="outline" className="text-muted-foreground">
              {t('interactions.archivedBadge')}
            </Badge>
          ) : (
            <Badge variant="outline">{interaction.prospectFunnelStageName}</Badge>
          )}
        </TableCell>

        <TableCell>
          <StatusIcon status={interaction.status} className="size-4" />
        </TableCell>

        <TableCell className="text-sm text-muted-foreground">{notesPreview}</TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="p-0">
            <div className="space-y-3 border-t bg-muted/30 px-4 py-3 text-sm">
              {isEditing ? (
                /* ── EDIT MODE ── */
                <form onSubmit={onFormSubmit} className="space-y-3">
                  {/* Status */}
                  <div className="flex flex-col gap-1">
                    <Label>
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
                      <ToggleGroupItem
                        value="positive"
                        aria-label={t('interactions.status.positive')}
                      >
                        <StatusIcon status="positive" className="size-4" withLabel />
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="pending"
                        aria-label={t('interactions.status.pending')}
                      >
                        <StatusIcon status="pending" className="size-4" withLabel />
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="negative"
                        aria-label={t('interactions.status.negative')}
                      >
                        <StatusIcon status="negative" className="size-4" withLabel />
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {/* Positioning */}
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

                  {/* Date */}
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`edit-date-${interaction.id}`}>
                      {t('interactions.detail.date')}
                    </Label>
                    <input
                      id={`edit-date-${interaction.id}`}
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      disabled={update.isPending}
                      className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
                    />
                  </div>

                  {/* Notes */}
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`edit-notes-${interaction.id}`}>
                      {t('interactions.fields.notes')}
                    </Label>
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
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRestore()
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
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditStart()
                        }}
                      >
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
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Archive className="size-4" />
                            {t('interactions.archive')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t('interactions.archiveDialog.title')}
                            </AlertDialogTitle>
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

                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">{t('interactions.detail.date')}</span>
                    <span>{new Date(interaction.interactionDate).toLocaleString()}</span>

                    <span className="text-muted-foreground">{t('interactions.fields.status')}</span>
                    <StatusIcon status={interaction.status} className="size-4" withLabel />

                    <span className="text-muted-foreground">
                      {t('interactions.detail.positioning')}
                    </span>
                    <span>{interaction.positioningName ?? t('interactions.noPositioning')}</span>

                    <span className="text-muted-foreground">{t('prospects.title')}</span>
                    <span>{interaction.prospectName}</span>
                  </div>

                  {interaction.notes && (
                    <div className="pt-1">
                      <p className="mb-1 text-xs text-muted-foreground">
                        {t('interactions.fields.notes')}
                      </p>
                      <p className="whitespace-pre-wrap">{interaction.notes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
