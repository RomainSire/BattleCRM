import { fetchApi } from '@/lib/api'

export const authApi = {
  register(email: string, password: string) {
    return fetchApi<{ user: { id: string; email: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  checkRegistrationStatus() {
    return fetchApi<{ allowed: boolean }>('/auth/registration-status')
  },

  me() {
    return fetchApi<{ id: string; email: string }>('/auth/me')
  },

  logout() {
    return fetchApi<{ message: string }>('/auth/logout', { method: 'POST' })
  },
}
