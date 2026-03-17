import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthLayout } from '@/components/layouts/AuthLayout'
import { GuestLayout } from '@/components/layouts/GuestLayout'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { GuestGuard } from '@/features/auth/components/GuestGuard'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { InteractionsPage } from '@/features/interactions/InteractionsPage'
import { PositioningsPage } from '@/features/positionings/PositioningsPage'
import { ProspectsPage } from '@/features/prospects/ProspectsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthGuard />}>
          <Route element={<AuthLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/interactions" element={<InteractionsPage />} />
            <Route path="/positionings" element={<PositioningsPage />} />
            <Route path="/prospects" element={<ProspectsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route element={<GuestGuard />}>
          <Route element={<GuestLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
