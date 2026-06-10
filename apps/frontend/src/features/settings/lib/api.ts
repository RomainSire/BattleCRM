import type { FunnelStageListResponse, FunnelStageType } from '@battlecrm/shared'
import { fetchApi, fetchBlob } from '@/lib/api'

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

export const backupApi = {
  /** Download the full account backup as a gzip blob (`.json.gz`). */
  export() {
    return fetchBlob('/backup/export')
  },

  /** Restore the account from a backup file (destructive, total replacement). */
  import(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return fetchApi<{ message: string }>('/backup/import', {
      method: 'POST',
      body: formData,
    })
  },
}
