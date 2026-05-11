import type { BattleType, PerformanceMatrixType } from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const analyticsApi = {
  getPerformanceMatrix() {
    return fetchApi<PerformanceMatrixType>('/analytics/performance_matrix')
  },
}

export const battlesApi = {
  list() {
    return fetchApi<{ data: BattleType[] }>('/battles')
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
}
