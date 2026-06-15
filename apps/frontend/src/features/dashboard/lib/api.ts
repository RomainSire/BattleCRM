import type {
  BattleListResponse,
  BattleType,
  DashboardSummaryType,
  MessageResponse,
  PerformanceMatrixType,
  PositioningLinkedProspectsResponse,
} from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const analyticsApi = {
  getPerformanceMatrix() {
    return fetchApi<PerformanceMatrixType>('/analytics/performance_matrix')
  },
  getSummary() {
    const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)
    return fetchApi<DashboardSummaryType>(`/analytics/summary?tz=${tz}`)
  },
  drillDown(positioningId: string, stageId: string) {
    return fetchApi<PositioningLinkedProspectsResponse>(
      `/positionings/${positioningId}/prospects?funnel_stage_id=${stageId}`,
    )
  },
}

export const battlesApi = {
  list() {
    return fetchApi<BattleListResponse>('/battles')
  },
  start(data: { funnel_stage_id: string; variant_a_id: string; variant_b_id: string }) {
    return fetchApi<BattleType>('/battles', { method: 'POST', body: JSON.stringify(data) })
  },
  close(id: string, data: { winner_id: string }) {
    return fetchApi<BattleType>(`/battles/${id}/close`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },
  cancel(id: string) {
    return fetchApi<MessageResponse>(`/battles/${id}`, { method: 'DELETE' })
  },
}
