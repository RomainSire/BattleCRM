import { useCallback } from 'react'

const LAST_PROSPECT_KEY = 'battlecrm_last_prospect_id'
const LAST_POSITIONING_KEY = 'battlecrm_last_positioning_by_stage'

export function useLastInteractionContext() {
  const lastProspectId = localStorage.getItem(LAST_PROSPECT_KEY) ?? undefined

  const getLastPositioningForStage = useCallback((stageId: string): string | undefined => {
    try {
      const stored = localStorage.getItem(LAST_POSITIONING_KEY)
      if (!stored) return undefined
      const map = JSON.parse(stored) as Record<string, string>
      return map[stageId]
    } catch {
      return undefined
    }
  }, [])

  const saveContext = useCallback(
    (prospectId: string, funnelStageId?: string, positioningId?: string) => {
      try {
        localStorage.setItem(LAST_PROSPECT_KEY, prospectId)
        if (funnelStageId) {
          const stored = localStorage.getItem(LAST_POSITIONING_KEY)
          const map: Record<string, string> = stored
            ? (JSON.parse(stored) as Record<string, string>)
            : {}
          if (positioningId && positioningId !== 'none') {
            map[funnelStageId] = positioningId
          } else {
            delete map[funnelStageId]
          }
          localStorage.setItem(LAST_POSITIONING_KEY, JSON.stringify(map))
        }
      } catch {
        // ignore storage failures silently (e.g. QuotaExceededError in private browsing)
      }
    },
    [],
  )

  return { lastProspectId, getLastPositioningForStage, saveContext }
}
