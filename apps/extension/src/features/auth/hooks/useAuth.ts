import { useMutation } from '@tanstack/react-query'
import { setStorage } from '../../../lib/storage'
import { authApi } from '../lib/api'

interface LoginParams {
  baseUrl: string
  email: string
  password: string
  tokenName: string
}

export function useLoginExtension() {
  return useMutation({
    mutationFn: async ({ baseUrl, email, password, tokenName }: LoginParams) => {
      const res = await authApi.login(baseUrl, email, password, tokenName)
      await setStorage({ token: res.token, baseUrl, email })
      return { email }
    },
  })
}
