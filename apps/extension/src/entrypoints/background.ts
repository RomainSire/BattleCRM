import { authApi } from '../features/auth/lib/api'
import { prospectsApi } from '../features/prospects/lib/api'
import { HttpError } from '../lib/api'
import { clearAuth, getStorage } from '../lib/storage'
import type { CachedCheckResult } from '../lib/types'

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'LOGOUT') {
      handleLogout().then(() => sendResponse({ success: true }))
      return true
    }
    if (message.type === 'CHECK_PROSPECT') {
      handleCheckProspect(message.linkedinUrl).then(() => sendResponse({ ok: true }))
      return true
    }
    if (message.type === 'CLEAR_BADGE') {
      handleClearBadge(message.previousUrl).then(() => sendResponse({ ok: true }))
      return true
    }
    if (message.type === 'CHECK_PROSPECTS_BATCH') {
      handleCheckProspectsBatch(message.urls).then((results) => sendResponse({ results }))
      return true
    }
    if (message.type === 'GET_PANEL_DATA') {
      handleGetPanelData(message.linkedinUrl).then((result) => sendResponse(result))
      return true
    }
    if (message.type === 'RECHECK_CURRENT_TAB') {
      handleRecheckCurrentTab().then(() => sendResponse({ ok: true }))
      return true
    }
  })
})

async function handleLogout(): Promise<void> {
  const { token, baseUrl } = await getStorage()
  if (token && baseUrl) {
    try {
      await authApi.logout(baseUrl, token)
    } catch {
      // Ignore API errors — always clear local storage regardless
    }
  }
  await clearAuth()
}

async function handleCheckProspect(linkedinUrl: string): Promise<void> {
  const { token } = await getStorage()
  if (!token) {
    await setGreyBadge()
    return
  }
  try {
    const result = await prospectsApi.check(linkedinUrl)
    if (result.found) {
      await browser.action.setBadgeText({ text: '✓' })
      await browser.action.setBadgeBackgroundColor({ color: '#16a34a' }) // green-600
      await browser.action.setTitle({ title: 'Prospect déjà dans BattleCRM' })
      const cached: CachedCheckResult = { found: true, prospect: result.prospect }
      await browser.storage.session.set({ [linkedinUrl]: cached })
    } else {
      await browser.action.setBadgeText({ text: '+' })
      await browser.action.setBadgeBackgroundColor({ color: '#dc2626' }) // red-600
      await browser.action.setTitle({ title: 'Ajouter ce prospect à BattleCRM' })
      await browser.storage.session.set({ [linkedinUrl]: { found: false } })
    }
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      await handleAuthExpired()
    } else {
      await clearBadge()
    }
  }
}

/**
 * Batch presence check for the people-search list. Returns a map of normalized URL -> boolean.
 * NEVER touches the toolbar badge (that's the profile-page feature). Fails silently — on no
 * token / network error / non-401 error we return an empty map so the list shows no badge.
 * Chunked to the backend's 50-URL cap.
 */
async function handleCheckProspectsBatch(urls: string[]): Promise<Record<string, boolean>> {
  const { token } = await getStorage()
  if (!token || !Array.isArray(urls) || urls.length === 0) return {}

  const CHUNK_SIZE = 50
  const merged: Record<string, boolean> = {}
  try {
    for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
      const chunk = urls.slice(i, i + CHUNK_SIZE)
      const res = await prospectsApi.checkBatch(chunk)
      Object.assign(merged, res.results)
    }
    return merged
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      await handleAuthExpired()
    }
    return {}
  }
}

async function handleClearBadge(previousUrl?: string): Promise<void> {
  await clearBadge()
  if (previousUrl) {
    await browser.storage.session.remove([previousUrl, `form:${previousUrl}`])
  }
}

async function handleGetPanelData(linkedinUrl: string): Promise<CachedCheckResult | null> {
  const result = await browser.storage.session.get(linkedinUrl)
  return (result[linkedinUrl] as CachedCheckResult) ?? null
}

async function setGreyBadge(): Promise<void> {
  await browser.action.setBadgeText({ text: '?' })
  await browser.action.setBadgeBackgroundColor({ color: '#6b7280' }) // gray-500
  await browser.action.setTitle({ title: 'BattleCRM' })
}

async function clearBadge(): Promise<void> {
  await browser.action.setBadgeText({ text: '' })
  await browser.action.setTitle({ title: 'BattleCRM' })
}

async function handleRecheckCurrentTab(): Promise<void> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (!tab?.id || !tab?.url) return
  try {
    const url = new URL(tab.url)
    if (url.hostname !== 'www.linkedin.com') return
    if (!/^\/in\/[^/]/.test(url.pathname)) return
  } catch {
    return
  }
  browser.tabs.sendMessage(tab.id, { type: 'DO_CHECK' }).catch(() => {})
}

async function handleAuthExpired(): Promise<void> {
  await clearAuth()
  try {
    await browser.runtime.sendMessage({ type: 'AUTH_EXPIRED' })
  } catch {
    // Popup may not be open — ignore
  }
}
