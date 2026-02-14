import { Navigate, Outlet } from 'react-router'
import { useCurrentUser } from '../hooks/useAuth'

export function AuthGuard() {
  const { data, isLoading, isError } = useCurrentUser()

  if (isLoading) {
    return null
  }

  if (isError || !data) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
