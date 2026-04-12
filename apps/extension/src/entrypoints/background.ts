import { logoutExtension } from '../lib/api'
import { clearAuth, getStorage } from '../lib/storage'

export default defineBackground(() => {
  console.log('BattleCRM service worker initialized', { id: browser.runtime.id })

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'LOGOUT') {
      handleLogout().then(() => sendResponse({ success: true }))
      return true // Keep channel open for async response (Chrome MV3 requirement)
    }
  })
})

async function handleLogout(): Promise<void> {
  const { token, baseUrl } = await getStorage()
  if (token && baseUrl) {
    try {
      await logoutExtension(baseUrl, token)
    } catch {
      // Ignore API errors — always clear local storage regardless
    }
  }
  await clearAuth()
}

// Called when any API call returns 401 (used by Stories 7.5/7.6)
export async function handleAuthExpired(): Promise<void> {
  await clearAuth()
  try {
    await browser.runtime.sendMessage({ type: 'AUTH_EXPIRED' })
  } catch {
    // Popup may not be open — ignore send errors
  }
}
