import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
