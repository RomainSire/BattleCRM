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
