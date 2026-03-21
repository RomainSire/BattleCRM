import { useTranslation } from 'react-i18next'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function DashboardPage() {
  const { t } = useTranslation()

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('dashboard.title')}</CardTitle>
        <CardDescription>{t('dashboard.description')}</CardDescription>
      </CardHeader>
    </Card>
  )
}
