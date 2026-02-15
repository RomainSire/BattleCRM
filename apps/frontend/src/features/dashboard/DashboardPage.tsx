import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div className="relative flex min-h-screen items-center justify-center p-8">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('dashboard.title')}</CardTitle>
          <CardDescription>{t('dashboard.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/login">{t('dashboard.goToLogin')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
