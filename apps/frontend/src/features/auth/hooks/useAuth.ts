import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { authApi } from '../lib/api'

/**
 * Fetch the currently authenticated user's information
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => authApi.me(),
    retry: false,
  })
}

/**
 * Check if registration is allowed based on environment variable
 */
export function useRegistrationStatus() {
  return useQuery({
    queryKey: queryKeys.auth.registrationStatus(),
    queryFn: () => authApi.checkRegistrationStatus(),
  })
}

/**
 * Register a new user and invalidate the current user query on success
 */
export function useRegister() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.register(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })
    },
  })
}

/**
 * Log in a user and invalidate the current user query on success
 */
export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })
    },
  })
}

/**
 * Change the current user's password
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: {
      currentPassword: string
      newPassword: string
      newPasswordConfirmation: string
    }) => authApi.changePassword(data),
  })
}

/**
 * Request a password-reset email for the given address
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: ({ email, locale }: { email: string; locale: string }) =>
      authApi.forgotPassword(email, locale),
  })
}

/**
 * Reset the password using a token received by email
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { token: string; password: string; passwordConfirmation: string }) =>
      authApi.resetPassword(data),
  })
}

/**
 * Log out the current user and clear all auth-related queries
 */
export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // setQueryData is used here instead of invalidateQueries to immediately reflect the logged-out state without waiting for a refetch
      queryClient.setQueryData(queryKeys.auth.me(), null)
    },
  })
}
