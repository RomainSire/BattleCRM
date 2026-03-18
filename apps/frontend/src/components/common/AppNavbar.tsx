import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/auth/hooks/useAuth'
import { CircleUser, LogOut, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'font-semibold text-brand-gradient'
    : 'text-muted-foreground hover:text-foreground transition-colors'
}

export function AppNavbar() {
  const { t } = useTranslation()
  const logout = useLogout()

  return (
    <nav className="border-b bg-background shadow-sm" aria-label="Main navigation">
      <div className="container mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <div className="flex gap-2 items-center">
          <img
            src="/images/BattleCRM_logo.svg"
            alt=""
            aria-hidden="true"
            className="size-10 shrink-0"
          />
          <span className="font-bold text-2xl text-brand-gradient">{t('common.appName')}</span>
        </div>

        <div className="flex flex-1 items-center gap-4">
          <NavLink to="/" className={navLinkClass}>
            {t('nav.dashboard')}
          </NavLink>
          <NavLink to="/prospects" className={navLinkClass}>
            {t('nav.prospects')}
          </NavLink>
          <NavLink to="/positionings" className={navLinkClass}>
            {t('nav.positionings')}
          </NavLink>
          <NavLink to="/interactions" className={navLinkClass}>
            {t('nav.interactions')}
          </NavLink>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('nav.userMenu.label')}>
              <CircleUser className="size-5 text-muted-foreground " />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <NavLink to="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="size-4" />
                {t('nav.settings')}
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut className="size-4" />
              {logout.isPending ? t('dashboard.loggingOut') : t('dashboard.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
