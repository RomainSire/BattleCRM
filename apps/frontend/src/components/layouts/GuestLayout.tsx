import { Outlet } from 'react-router'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher'

export function GuestLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center p-8">
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <ThemeSwitcher />
        <LanguageToggle variant="compact" />
      </div>
      <Outlet />
    </div>
  )
}
