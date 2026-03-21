/**
 * API helpers for E2E test setup and teardown.
 *
 * Pure functions — accept Playwright's APIRequestContext explicitly.
 * BattleCRM backend is at localhost:3333 (Vite does NOT proxy /api in dev).
 */

import type { APIRequestContext } from '@playwright/test'

const API_URL = process.env.E2E_API_URL || 'http://localhost:3333'

/** Register a new user. Throws if registration fails (unless 409 email exists). */
export async function register(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  const res = await request.post(`${API_URL}/api/auth/register`, {
    data: { email, password, password_confirmation: password },
  })
  // 409 = email already exists — acceptable in idempotent setup
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`register failed: ${res.status()} ${await res.text()}`)
  }
}

/** Login. Sets session cookie in the browser context's cookie jar. */
export async function login(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<void> {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  })
  if (!res.ok()) {
    throw new Error(`login failed: ${res.status()} ${await res.text()}`)
  }
}

/** Logout. Clears the session on the backend. */
export async function logout(request: APIRequestContext): Promise<void> {
  await request.post(`${API_URL}/api/auth/logout`)
}

/** Check health. Useful to verify backend is running before tests. */
export async function checkHealth(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(`${API_URL}/api/health`)
    return res.ok()
  } catch {
    return false
  }
}

/**
 * Reset funnel stages to a known set of defaults.
 * Deletes all active stages then recreates a minimal set.
 * Requires an authenticated request context (session cookie).
 */
export async function resetFunnelStages(request: APIRequestContext): Promise<void> {
  const res = await request.get(`${API_URL}/api/funnel_stages`)
  const body = await res.json()
  for (const stage of body.data ?? []) {
    await request.delete(`${API_URL}/api/funnel_stages/${stage.id}`)
  }
  for (const name of ['Lead qualified', 'Linkedin connection', 'First contact']) {
    await request.post(`${API_URL}/api/funnel_stages`, { data: { name } })
  }
}

/**
 * Get all active funnel stages sorted by position.
 * Requires an authenticated request context.
 */
export async function getFunnelStages(
  request: APIRequestContext,
): Promise<Array<{ id: string; name: string; position: number }>> {
  const res = await request.get(`${API_URL}/api/funnel_stages`)
  const body = await res.json()
  return body.data ?? []
}

/**
 * Create a prospect. Returns the created prospect object.
 * Requires an authenticated request context.
 */
export async function createProspect(
  request: APIRequestContext,
  data: {
    name: string
    funnel_stage_id?: string
    company?: string
    email?: string
    title?: string
    notes?: string
  },
): Promise<{ id: string; name: string; funnelStageId: string; deletedAt: string | null }> {
  const res = await request.post(`${API_URL}/api/prospects`, { data })
  if (!res.ok()) throw new Error(`createProspect failed: ${res.status()} ${await res.text()}`)
  return res.json()
}

/**
 * Create a positioning. Returns the created positioning object.
 * Requires an authenticated request context.
 */
export async function createPositioning(
  request: APIRequestContext,
  data: {
    name: string
    funnel_stage_id?: string
    description?: string
    content?: string
  },
): Promise<{ id: string; name: string; funnelStageId: string; deletedAt: string | null }> {
  // If no stage provided, use the first available stage
  let stageId = data.funnel_stage_id
  if (!stageId) {
    const stages = await getFunnelStages(request)
    stageId = stages[0]?.id
    if (!stageId) throw new Error('createPositioning: no funnel stages available')
  }
  const res = await request.post(`${API_URL}/api/positionings`, {
    data: { ...data, funnel_stage_id: stageId },
  })
  if (!res.ok()) throw new Error(`createPositioning failed: ${res.status()} ${await res.text()}`)
  return res.json()
}

/**
 * Reset positionings to a clean slate (including archived ones).
 * Restores archived positionings first so destroy can find them, then soft-deletes all.
 * Requires an authenticated request context.
 */
export async function resetPositionings(request: APIRequestContext): Promise<void> {
  const res = await request.get(`${API_URL}/api/positionings?include_archived=true`)
  const body = await res.json()
  const positionings: Array<{ id: string; deletedAt: string | null }> = body.data ?? []

  // Restore archived positionings so destroy can find them
  for (const p of positionings) {
    if (p.deletedAt !== null) {
      await request.patch(`${API_URL}/api/positionings/${p.id}/restore`)
    }
  }

  // Archive (soft-delete) all positionings
  for (const p of positionings) {
    await request.delete(`${API_URL}/api/positionings/${p.id}`)
  }
}

/**
 * Create an interaction. Returns the created interaction object.
 * Requires an authenticated request context.
 */
export async function createInteraction(
  request: APIRequestContext,
  data: {
    prospect_id: string
    status: 'positive' | 'pending' | 'negative'
    notes?: string
    positioning_id?: string
    interaction_date?: string // ISO date string YYYY-MM-DD
  },
): Promise<{ id: string; prospectId: string; status: string; deletedAt: string | null }> {
  const res = await request.post(`${API_URL}/api/interactions`, { data })
  if (!res.ok()) throw new Error(`createInteraction failed: ${res.status()} ${await res.text()}`)
  return res.json()
}

/**
 * Reset interactions to a clean slate (including archived).
 * Restores archived ones first (so DELETE can find them), then soft-deletes all.
 * Requires an authenticated request context.
 */
export async function resetInteractions(request: APIRequestContext): Promise<void> {
  const res = await request.get(`${API_URL}/api/interactions?include_archived=true`)
  const body = await res.json()
  const interactions: Array<{ id: string; deletedAt: string | null }> = body.data ?? []

  for (const i of interactions) {
    if (i.deletedAt !== null) {
      await request.patch(`${API_URL}/api/interactions/${i.id}/restore`)
    }
  }
  for (const i of interactions) {
    await request.delete(`${API_URL}/api/interactions/${i.id}`)
  }
}

/**
 * Delete (soft-delete) all prospects, including archived ones.
 * Archived prospects are restored first (backend destroy only works on active),
 * then archived again — leaving a clean slate of only archived records.
 * Requires an authenticated request context.
 */
export async function resetProspects(request: APIRequestContext): Promise<void> {
  const res = await request.get(`${API_URL}/api/prospects?include_archived=true`)
  const body = await res.json()
  const prospects: Array<{ id: string; deletedAt: string | null }> = body.data ?? []

  // Restore archived prospects so destroy can find them
  for (const p of prospects) {
    if (p.deletedAt !== null) {
      await request.patch(`${API_URL}/api/prospects/${p.id}/restore`)
    }
  }

  // Archive (soft-delete) all prospects
  for (const p of prospects) {
    await request.delete(`${API_URL}/api/prospects/${p.id}`)
  }
}
