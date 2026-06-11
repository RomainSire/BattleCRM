import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const sizeStyles = {
  sm: { icon: 'size-7', text: 'text-xl' },
  md: { icon: 'size-10', text: 'text-2xl' },
  lg: { icon: 'size-12', text: 'text-3xl' },
} as const

interface AppLogoProps {
  /** Visual size of the logo. Defaults to `md`. */
  size?: keyof typeof sizeStyles
  className?: string
}

/**
 * BattleCRM brand logo: the SVG mark followed by the app name in the brand
 * gradient. Used in the navbar and on the guest (unauthenticated) pages.
 */
export function AppLogo({ size = 'md', className }: AppLogoProps) {
  const { t } = useTranslation()
  const styles = sizeStyles[size]

  return (
    <span className={cn('flex items-center gap-2', className)}>
      <img
        src="/images/BattleCRM_logo.svg"
        alt=""
        aria-hidden="true"
        className={cn('shrink-0', styles.icon)}
      />
      <span className={cn('font-bold text-brand-gradient', styles.text)}>
        {t('common.appName')}
      </span>
    </span>
  )
}
