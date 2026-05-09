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
}
