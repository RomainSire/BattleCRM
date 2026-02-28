import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher'

export function AppNavbar() {
  const { t } = useTranslation()

  return (
    <nav className="border-b bg-background" aria-label="Main navigation">
      <div className="container mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <span className="font-semibold">{t('common.appName')}</span>

        <div className="flex flex-1 items-center gap-4">
          <NavLink
            to="/"
            className={({ isActive }) =>
              isActive
                ? 'font-medium text-foreground underline underline-offset-4'
                : 'text-muted-foreground hover:text-foreground'
            }
          >
            {t('nav.dashboard')}
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              isActive
                ? 'font-medium text-foreground underline underline-offset-4'
                : 'text-muted-foreground hover:text-foreground'
            }
          >
            {t('nav.settings')}
          </NavLink>
          <NavLink
            to="/prospects"
            className={({ isActive }) =>
              isActive
                ? 'font-medium text-foreground underline underline-offset-4'
                : 'text-muted-foreground hover:text-foreground'
            }
          >
            {t('nav.prospects')}
          </NavLink>
          <span className="cursor-not-allowed text-muted-foreground/50">
            {t('nav.positionings')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  )
}
