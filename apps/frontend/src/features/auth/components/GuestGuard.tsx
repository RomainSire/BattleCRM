import { Navigate, Outlet } from 'react-router'
import { useCurrentUser } from '../hooks/useAuth'

export function GuestGuard() {
  const { data, isLoading } = useCurrentUser()

  if (isLoading) {
    return null
  }

  if (data) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
