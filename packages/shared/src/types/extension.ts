import type { UserType } from './auth.js'

export type ExtensionLoginResponse = {
  token: string
  user: UserType
}

export type ExtensionProspectData = {
  id: string
  name: string
  company: string | null
  linkedinUrl: string | null
  email: string | null
  phone: string | null
  title: string | null
  notes: string | null
  funnelStageId: string
  funnelStageName: string
}

export type ExtensionCheckResponse =
  | { found: true; prospect: ExtensionProspectData }
  | { found: false }

// Request payloads — aligned with extensionCreate/UpdateProspectValidator (snake_case keys)
export type ExtensionCreateProspectPayload = {
  name: string
  linkedin_url: string
  company?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  notes?: string | null
}

export type ExtensionUpdateProspectPayload = {
  name?: string
  company?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  notes?: string | null
  // linkedin_url & funnel_stage_id intentionally excluded (read-only / web app only)
}
