import type { AuthResponse, MessageResponse, UserType } from '@battlecrm/shared'
import { fetchApi } from '@/lib/api'

export const authApi = {
  register(email: string, password: string) {
    return fetchApi<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  checkRegistrationStatus() {
    return fetchApi<{ allowed: boolean }>('/auth/registration-status')
  },

  me() {
    return fetchApi<UserType>('/auth/me')
  },

  login(email: string, password: string) {
    return fetchApi<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  logout() {
    return fetchApi<MessageResponse>('/auth/logout', { method: 'POST' })
  },

  changePassword(data: {
    currentPassword: string
    newPassword: string
    newPasswordConfirmation: string
  }) {
    return fetchApi<MessageResponse>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  forgotPassword(email: string, locale: string) {
    return fetchApi<MessageResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, locale }),
    })
  },

  resetPassword(data: { token: string; password: string; passwordConfirmation: string }) {
    return fetchApi<MessageResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}
