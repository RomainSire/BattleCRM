import type { PositioningType, ProspectType } from '@battlecrm/shared'
import { AlertCircle, CheckCircle2, Clock, Info, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { usePositionings } from '@/features/positionings/hooks/usePositionings'
import { ApiError } from '@/lib/api'
import {
  useAssignPositioning,
  useSetPositioningOutcome,
} from '../hooks/useProspectPositioningMutations'
import { useProspectPositionings } from '../hooks/useProspectPositionings'

interface PositioningSectionProps {
  prospect: ProspectType
  /** True when the prospect's current stage is known to have at least one non-archived positioning */
  stageHasPositionings: boolean
  isArchived?: boolean
}

export function PositioningSection({
  prospect,
  stageHasPositionings,
  isArchived = false,
}: PositioningSectionProps) {
  const { t } = useTranslation()
  const [assignError, setAssignError] = useState<string | null>(null)
  const [outcomeError, setOutcomeError] = useState<string | null>(null)
  const [isReassigning, setIsReassigning] = useState(false)

  const assign = useAssignPositioning()
  const setOutcome = useSetPositioningOutcome()

  // Load positionings for assign/reassign select — enabled for State A or when user clicks "Changer"
  const { data: positioningsData } = usePositionings(
    { funnel_stage_id: prospect.funnelStageId },
    {
      enabled:
        !isArchived && (!prospect.activePositioning || isReassigning) && stageHasPositionings,
    },
  )
  const availablePositionings = (positioningsData?.data ?? []) as PositioningType[]

  // Load full positioning history for this prospect
  const { data: historyData } = useProspectPositionings(prospect.id)
  const pastPositionings = (historyData?.data ?? []).filter((pp) => !pp.isActive)

  const { activePositioning } = prospect

  function handleAssign(positioningId: string) {
    setAssignError(null)
    assign.mutate(
      { prospectId: prospect.id, positioningId },
      {
        onSuccess: () => setIsReassigning(false),
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setAssignError(message ?? t('prospects.positioning.assignFailed'))
        },
      },
    )
  }

  function handleSetOutcome(outcome: 'success' | 'failed') {
    setOutcomeError(null)
    setOutcome.mutate(
      { prospectId: prospect.id, outcome },
      {
        onError: (error) => {
          const message = error instanceof ApiError ? error.errors[0]?.message : undefined
          setOutcomeError(message ?? t('prospects.positioning.setOutcomeFailed'))
        },
      },
    )
  }

  // Reassign select — shared by State B and State C when isReassigning=true
  const reassignSelect = (
    <div className="flex flex-col gap-2">
      <Select onValueChange={handleAssign} disabled={assign.isPending}>
        <SelectTrigger id={`positioning-select-${prospect.id}`} className="w-full">
          <SelectValue placeholder={t('prospects.positioning.assignPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {availablePositionings.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="self-start"
        onClick={() => {
          setIsReassigning(false)
          setAssignError(null)
        }}
      >
        {t('common.cancel')}
      </Button>
      {assignError && <FieldError>{assignError}</FieldError>}
    </div>
  )

  // Shared history block — past positionings (not the current stage's)
  const historyBlock =
    pastPositionings.length > 0 ? (
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">
          {t('prospects.positioning.history')}
        </p>
        <ul className="flex flex-col gap-1">
          {pastPositionings.map((pp) => (
            <li key={pp.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {pp.outcome === 'success' ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                    ) : pp.outcome === 'failed' ? (
                      <XCircle className="size-3.5 shrink-0 text-destructive" />
                    ) : (
                      <Clock className="size-3.5 shrink-0 text-yellow-500" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {pp.outcome === 'success'
                      ? t('prospects.positioning.outcomeSuccess')
                      : pp.outcome === 'failed'
                        ? t('prospects.positioning.outcomeFailedLabel')
                        : t('prospects.positioning.inProgress')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="truncate">{pp.positioningName}</span>
              <span className="shrink-0 text-muted-foreground/60">· {pp.funnelStageName}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null

  // Archived prospect — show only history (no interactive UI)
  if (isArchived) {
    if (!historyBlock) return null
    return (
      <div className="flex flex-col gap-2">
        <Label>{t('prospects.fields.positioning')}</Label>
        {historyBlock}
      </div>
    )
  }

  // State C — outcome decided: icon + name + change outcome buttons + reassign option
  if (activePositioning && activePositioning.outcome !== null) {
    return (
      <div className="flex flex-col gap-2">
        <Label>{t('prospects.fields.positioning')}</Label>
        {isReassigning ? (
          reassignSelect
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {activePositioning.outcome === 'success' ? (
                      <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="size-4 shrink-0 text-destructive" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {activePositioning.outcome === 'success'
                      ? t('prospects.positioning.outcomeSuccess')
                      : t('prospects.positioning.outcomeFailedLabel')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span>{activePositioning.positioningName}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-green-600/40 text-green-700 hover:bg-green-50 hover:text-green-700"
                disabled={setOutcome.isPending}
                onClick={() => handleSetOutcome('success')}
              >
                ✓ {t('prospects.positioning.success')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={setOutcome.isPending}
                onClick={() => handleSetOutcome('failed')}
              >
                ✗ {t('prospects.positioning.fail')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={assign.isPending}
                onClick={() => setIsReassigning(true)}
              >
                {t('prospects.positioning.changePositioning')}
              </Button>
            </div>
            {outcomeError && <FieldError>{outcomeError}</FieldError>}
          </>
        )}
        {historyBlock}
      </div>
    )
  }

  // State B — active positioning, outcome=null: name + yellow icon + success/fail + reassign option
  if (activePositioning) {
    return (
      <div className="flex flex-col gap-2">
        <Label>{t('prospects.fields.positioning')}</Label>
        {isReassigning ? (
          reassignSelect
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Clock className="size-4 shrink-0 text-yellow-500" />
                  </TooltipTrigger>
                  <TooltipContent>{t('prospects.positioning.inProgress')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span>{activePositioning.positioningName}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-green-600/40 text-green-700 hover:bg-green-50 hover:text-green-700"
                disabled={setOutcome.isPending}
                onClick={() => handleSetOutcome('success')}
              >
                ✓ {t('prospects.positioning.success')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={setOutcome.isPending}
                onClick={() => handleSetOutcome('failed')}
              >
                ✗ {t('prospects.positioning.fail')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={assign.isPending}
                onClick={() => setIsReassigning(true)}
              >
                {t('prospects.positioning.changePositioning')}
              </Button>
            </div>
            {outcomeError && <FieldError>{outcomeError}</FieldError>}
          </>
        )}
        {historyBlock}
      </div>
    )
  }

  // State A — no active positioning, stage has positionings: alert icon + assign select
  return (
    <div className="flex flex-col gap-2">
      {stageHasPositionings && (
        <>
          <Label htmlFor={`positioning-select-${prospect.id}`}>
            <span className="flex items-center gap-1.5">
              <AlertCircle className="size-3.5 text-destructive" aria-hidden="true" />
              {t('prospects.fields.positioning')}
            </span>
          </Label>
          <Select onValueChange={handleAssign} disabled={assign.isPending}>
            <SelectTrigger id={`positioning-select-${prospect.id}`} className="w-full">
              <SelectValue placeholder={t('prospects.positioning.assignPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {availablePositionings.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignError && <FieldError>{assignError}</FieldError>}
        </>
      )}
      {!stageHasPositionings && (
        <>
          <Label>{t('prospects.fields.positioning')}</Label>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            {t('prospects.positioning.noneConfigured')}
          </p>
        </>
      )}
      {historyBlock}
    </div>
  )
}
