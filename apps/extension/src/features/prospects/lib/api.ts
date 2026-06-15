import type {
  ExtensionCheckResponse,
  ExtensionCreateProspectPayload,
  ExtensionProspectData,
  ExtensionUpdateProspectPayload,
} from '@battlecrm/shared'
import { fetchExtensionApi } from '../../../lib/api'

export const prospectsApi = {
  check(linkedinUrl: string): Promise<ExtensionCheckResponse> {
    return fetchExtensionApi(`/prospects/check?linkedin_url=${encodeURIComponent(linkedinUrl)}`)
  },

  create(payload: ExtensionCreateProspectPayload): Promise<ExtensionProspectData> {
    return fetchExtensionApi('/prospects', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  update(id: string, payload: ExtensionUpdateProspectPayload): Promise<ExtensionProspectData> {
    return fetchExtensionApi(`/prospects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
}
