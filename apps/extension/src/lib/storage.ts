export interface ExtensionStorage {
  token?: string
  baseUrl?: string
  email?: string
}

/** Read all auth-related keys from chrome.storage.local */
export async function getStorage(): Promise<ExtensionStorage> {
  return browser.storage.local.get(['token', 'baseUrl', 'email']) as Promise<ExtensionStorage>
}

/** Persist partial auth data to chrome.storage.local */
export async function setStorage(data: Partial<ExtensionStorage>): Promise<void> {
  return browser.storage.local.set(data)
}

/** Delete token, baseUrl, email (called on logout or 401) */
export async function clearAuth(): Promise<void> {
  return browser.storage.local.remove(['token', 'baseUrl', 'email'])
}
