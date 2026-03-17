import type { InteractionStatus } from '@battlecrm/shared'
import { CheckCircle, Clock, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface StatusIconProps {
  status: InteractionStatus
  className?: string
  withLabel?: boolean
}

export function StatusIcon({ status, className, withLabel }: StatusIconProps) {
  const { t } = useTranslation()
  const label = t(`interactions.status.${status}`)

  const icon = (() => {
    if (status === 'positive')
      return <CheckCircle aria-hidden="true" className={cn('text-green-500', className)} />
    if (status === 'negative')
      return <XCircle aria-hidden="true" className={cn('text-red-500', className)} />
    return <Clock aria-hidden="true" className={cn('text-yellow-500', className)} />
  })()

  if (!withLabel) {
    return (
      <span role="img" aria-label={label}>
        {icon}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1">
      {icon}
      {label}
    </span>
  )
}
