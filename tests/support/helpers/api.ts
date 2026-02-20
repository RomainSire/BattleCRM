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
