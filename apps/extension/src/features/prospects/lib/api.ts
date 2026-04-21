import type { ExtensionCheckResponse, ExtensionProspectData } from '@battlecrm/shared'
import { fetchExtensionApi } from '../../../lib/api'

export type CreateProspectPayload = {
  name: string
  linkedin_url: string
  company?: string
  title?: string
  email?: string
  phone?: string
}

export type UpdateProspectPayload = Partial<
  Omit<ExtensionProspectData, 'id' | 'linkedinUrl' | 'funnelStageId' | 'funnelStageName'>
>

export const prospectsApi = {
  check(linkedinUrl: string): Promise<ExtensionCheckResponse> {
    return fetchExtensionApi(`/prospects/check?linkedin_url=${encodeURIComponent(linkedinUrl)}`)
  },

  create(payload: CreateProspectPayload): Promise<ExtensionProspectData> {
    return fetchExtensionApi('/prospects', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  update(id: string, payload: UpdateProspectPayload): Promise<ExtensionProspectData> {
    return fetchExtensionApi(`/prospects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
}
