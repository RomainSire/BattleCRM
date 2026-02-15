import { Outlet } from 'react-router'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher'

export function GuestLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-8">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <ThemeSwitcher />
        <LanguageSwitcher />
      </div>
      <Outlet />
    </div>
  )
}
