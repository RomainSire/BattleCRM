import i18next from 'i18next'

const API_BASE = import.meta.env.VITE_API_URL

interface ApiErrorDetail {
  message: string
  field?: string
  rule?: string
  meta?: Record<string, unknown>
}

/**
 * Custom error class for API errors, containing status code and error details
 */
export class ApiError extends Error {
  status: number
  errors: ApiErrorDetail[]

  constructor(status: number, errors: ApiErrorDetail[]) {
    super(errors[0]?.message ?? 'An error occurred')
    this.status = status
    this.errors = errors
  }
}

/**
 * Translate a backend error using i18next.
 * If the message looks like a translation key (contains a dot), translate it.
 * Otherwise, return the message as-is (fallback).
 */
export function translateError(error: ApiErrorDetail): string {
  if (i18next.exists(error.message)) {
    return i18next.t(error.message, {
      ...error.meta,
      field: error.field ? i18next.t(`auth.fields.${error.field}`) : undefined,
    })
  }
  return error.message
}

/**
 * Helper function to make API requests with consistent error handling
 * @param path API endpoint path (e.g., '/auth/register')
 * @param options Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response from the API if successful, or throws an ApiError if the response is not ok
 */
export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  // FormData uploads must keep the browser-generated multipart boundary header.
  const isFormData = options?.body instanceof FormData
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const errors = body?.errors ?? [{ message: body?.message ?? 'An error occurred' }]
    throw new ApiError(response.status, errors)
  }

  return response.json() as Promise<T>
}

/**
 * Fetch a binary response (e.g. a file download) as a Blob.
 * Returns the blob plus the filename parsed from the `Content-Disposition` header.
 */
export async function fetchBlob(
  path: string,
  options?: RequestInit,
): Promise<{ blob: Blob; filename: string | null }> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const errors = body?.errors ?? [{ message: body?.message ?? 'An error occurred' }]
    throw new ApiError(response.status, errors)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition')
  const filename = disposition?.match(/filename="?([^"]+)"?/)?.[1] ?? null
  return { blob, filename }
}
