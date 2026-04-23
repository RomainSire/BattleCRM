import type { ExtensionProspectData } from '@battlecrm/shared'
import { authApi } from '../features/auth/lib/api'
import { prospectsApi } from '../features/prospects/lib/api'
import { HttpError } from '../lib/api'
import type { LinkedInScrapedData } from '../lib/linkedin'
import { clearAuth, getStorage } from '../lib/storage'

type CachedCheckResult =
  | { found: true; prospect: ExtensionProspectData }
  | { found: false; scrapedData: LinkedInScrapedData }

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'LOGOUT') {
      handleLogout().then(() => sendResponse({ success: true }))
      return true
    }
    if (message.type === 'CHECK_PROSPECT') {
      handleCheckProspect(message.linkedinUrl, message.scrapedData).then(() =>
        sendResponse({ ok: true }),
      )
      return true
    }
    if (message.type === 'CLEAR_BADGE') {
      handleClearBadge(message.previousUrl).then(() => sendResponse({ ok: true }))
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

async function handleCheckProspect(
  linkedinUrl: string,
  scrapedData: LinkedInScrapedData,
): Promise<void> {
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
      const cached: CachedCheckResult = { found: false, scrapedData }
      await browser.storage.session.set({ [linkedinUrl]: cached })
    }
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      await handleAuthExpired()
    } else {
      await clearBadge()
    }
  }
}

async function handleClearBadge(previousUrl?: string): Promise<void> {
  await clearBadge()
  if (previousUrl) {
    await browser.storage.session.remove(previousUrl)
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
