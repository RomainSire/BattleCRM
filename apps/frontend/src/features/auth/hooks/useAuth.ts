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
 * Log out the current user and clear all auth-related queries
 */
export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all })
    },
  })
}
