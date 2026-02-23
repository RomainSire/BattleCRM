import { Outlet } from 'react-router'
import { AppNavbar } from '@/components/common/AppNavbar'

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="container mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
