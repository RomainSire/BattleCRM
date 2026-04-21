import { getStorage } from './storage'

export class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`)
  }
}

/**
 * Authenticated fetch for extension API calls.
 * Reads baseUrl and token from storage automatically — callers don't need to pass credentials.
 */
export async function fetchExtensionApi<T>(path: string, options?: RequestInit): Promise<T> {
  const { baseUrl, token } = await getStorage()
  if (!baseUrl || !token) throw new HttpError(401)

  const res = await fetch(`${baseUrl}/api/extension${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) throw new HttpError(res.status)
  return res.json() as Promise<T>
}
