import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'font-medium text-foreground underline underline-offset-4'
    : 'text-muted-foreground hover:text-foreground'
}

export function AppNavbar() {
  const { t } = useTranslation()

  return (
    <nav className="border-b bg-background" aria-label="Main navigation">
      <div className="container mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <div className='flex gap-1 items-center'>
          <img src="/images/BattleCRM_logo.svg" alt="" aria-hidden="true" className="size-10 shrink-0" />
          <span className="font-semibold text-xl">{t('common.appName')}</span>
        </div>

        <div className="flex flex-1 items-center gap-4">
          <NavLink to="/" className={navLinkClass}>
            {t('nav.dashboard')}
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            {t('nav.settings')}
          </NavLink>
          <NavLink to="/prospects" className={navLinkClass}>
            {t('nav.prospects')}
          </NavLink>
          <NavLink to="/positionings" className={navLinkClass}>
            {t('nav.positionings')}
          </NavLink>
        </div>

        <div className="flex items-center gap-1">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  )
}
