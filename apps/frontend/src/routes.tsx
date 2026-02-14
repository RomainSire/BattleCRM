import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { GuestGuard } from '@/features/auth/components/GuestGuard'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthGuard />}>
          <Route path="/" element={<DashboardPage />} />
        </Route>
        <Route element={<GuestGuard />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
