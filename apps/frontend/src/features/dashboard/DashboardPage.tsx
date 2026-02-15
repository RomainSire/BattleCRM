import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLogout } from '@/features/auth/hooks/useAuth'

export function DashboardPage() {
  const { t } = useTranslation()
  const logout = useLogout()

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('dashboard.title')}</CardTitle>
        <CardDescription>{t('dashboard.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
          {t('dashboard.logout')}
        </Button>
      </CardContent>
    </Card>
  )
}
