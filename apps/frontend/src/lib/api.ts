const API_BASE = import.meta.env.VITE_API_URL

/**
 * Custom error class for API errors, containing status code and error details
 */
export class ApiError extends Error {
  status: number
  errors: Array<{ message: string; field?: string; rule?: string }>

  constructor(status: number, errors: Array<{ message: string; field?: string; rule?: string }>) {
    super(errors[0]?.message ?? 'An error occurred')
    this.status = status
    this.errors = errors
  }
}

/**
 * Helper function to make API requests with consistent error handling
 * @param path API endpoint path (e.g., '/auth/register')
 * @param options Fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response from the API if successful, or throws an ApiError if the response is not ok
 */
export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
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
