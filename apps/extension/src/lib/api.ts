import type { ExtensionCheckResponse, ExtensionProspectData } from '@battlecrm/shared'

/** POST /api/extension/auth/login — returns raw token (one-time display) */
export async function loginExtension(
  baseUrl: string,
  email: string,
  password: string,
  name = 'Extension',
): Promise<{ token: string; user: { id: string; email: string } }> {
  const res = await fetch(`${baseUrl}/api/extension/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** POST /api/extension/auth/logout — revokes the token */
export async function logoutExtension(baseUrl: string, token: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/extension/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

/** GET /api/extension/prospects/check */
export async function checkProspect(
  baseUrl: string,
  token: string,
  linkedinUrl: string,
): Promise<ExtensionCheckResponse> {
  const res = await fetch(
    `${baseUrl}/api/extension/prospects/check?linkedin_url=${encodeURIComponent(linkedinUrl)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ExtensionCheckResponse>
}

/** POST /api/extension/prospects */
export async function createProspect(
  baseUrl: string,
  token: string,
  payload: {
    name: string
    linkedin_url: string
    company?: string
    title?: string
    email?: string
    phone?: string
  },
): Promise<ExtensionProspectData> {
  const res = await fetch(`${baseUrl}/api/extension/prospects`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ExtensionProspectData>
}

/** PATCH /api/extension/prospects/:id */
export async function updateProspect(
  baseUrl: string,
  token: string,
  id: string,
  payload: Partial<
    Omit<ExtensionProspectData, 'id' | 'linkedinUrl' | 'funnelStageId' | 'funnelStageName'>
  >,
): Promise<ExtensionProspectData> {
  const res = await fetch(`${baseUrl}/api/extension/prospects/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ExtensionProspectData>
}
