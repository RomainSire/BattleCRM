import { authApi } from '../features/auth/lib/api'
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
      await authApi.logout(baseUrl, token)
    } catch {
      // Ignore API errors — always clear local storage regardless
    }
  }
  await clearAuth()
}

// Called from within background.ts when any API call returns 401 (wired up in Stories 7.5/7.6)
// biome-ignore lint/correctness/noUnusedVariables: intentional stub for upcoming stories
async function handleAuthExpired(): Promise<void> {
  await clearAuth()
  try {
    await browser.runtime.sendMessage({ type: 'AUTH_EXPIRED' })
  } catch {
    // Popup may not be open — ignore send errors
  }
}
