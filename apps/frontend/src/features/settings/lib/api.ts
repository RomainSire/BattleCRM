import type { FunnelStageListResponse, FunnelStageType } from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const funnelStagesApi = {
  list() {
    return fetchApi<FunnelStageListResponse>('/funnel_stages')
  },

  create(name: string) {
    return fetchApi<FunnelStageType>('/funnel_stages', {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
  },

  update(id: string, name: string) {
    return fetchApi<FunnelStageType>(`/funnel_stages/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    })
  },

  delete(id: string) {
    return fetchApi<{ message: string }>(`/funnel_stages/${id}`, {
      method: 'DELETE',
    })
  },

  reorder(order: string[]) {
    return fetchApi<FunnelStageListResponse>('/funnel_stages/reorder', {
      method: 'PUT',
      body: JSON.stringify({ order }),
    })
  },
}
