import { CircleUser, LogOut, Menu, Settings } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useLogout } from '@/features/auth/hooks/useAuth'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `outline-none rounded-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${
    isActive
      ? 'font-semibold text-brand-gradient'
      : 'text-muted-foreground hover:text-foreground transition-colors'
  }`
}

function mobileNavLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-md px-3 py-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] ${
    isActive
      ? 'bg-muted font-semibold text-brand-gradient'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`
}

export function AppNavbar() {
  const { t } = useTranslation()
  const logout = useLogout()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { to: '/', label: t('nav.dashboard') },
    { to: '/positionings', label: t('nav.positionings') },
    { to: '/prospects', label: t('nav.prospects') },
    { to: '/interactions', label: t('nav.interactions') },
  ]

  return (
    <nav className="border-b bg-background shadow-sm" aria-label="Main navigation">
      <div className="container mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img
            src="/images/BattleCRM_logo.svg"
            alt=""
            aria-hidden="true"
            className="size-10 shrink-0"
          />
          <span className="font-bold text-2xl text-brand-gradient">{t('common.appName')}</span>
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex flex-1 items-center gap-4">
          {navLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} className={navLinkClass}>
              {label}
            </NavLink>
          ))}
        </div>

        {/* Desktop user dropdown */}
        <div className="hidden md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('nav.userMenu.label')}>
                <CircleUser className="size-5 text-muted-foreground" />
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

        {/* Mobile burger menu */}
        <div className="ml-auto flex md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('nav.mobileMenu.label')}>
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 flex flex-col p-0">
              <SheetHeader className="px-6 py-4 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <img
                    src="/images/BattleCRM_logo.svg"
                    alt=""
                    aria-hidden="true"
                    className="size-7 shrink-0"
                  />
                  <span className="font-bold text-xl text-brand-gradient">
                    {t('common.appName')}
                  </span>
                </SheetTitle>
              </SheetHeader>

              <nav
                className="flex flex-col gap-1 px-3 py-4 flex-1 overflow-y-auto"
                aria-label="Mobile navigation"
              >
                {navLinks.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={mobileNavLinkClass}
                    onClick={() => setMobileOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))}
              </nav>

              <div className="px-3 pb-6 shrink-0">
                <Separator className="mb-3" />
                <NavLink
                  to="/settings"
                  className={mobileNavLinkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  <Settings className="size-4" />
                  {t('nav.settings')}
                </NavLink>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-base text-destructive transition-colors hover:bg-muted disabled:opacity-50"
                  disabled={logout.isPending}
                  onClick={() => {
                    logout.mutate()
                    setMobileOpen(false)
                  }}
                >
                  <LogOut className="size-4" />
                  {logout.isPending ? t('dashboard.loggingOut') : t('dashboard.logout')}
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
