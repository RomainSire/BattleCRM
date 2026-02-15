import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useRegistrationStatus } from './hooks/useAuth'

export function LoginPage() {
  const { t } = useTranslation()
  const { data: registrationStatus } = useRegistrationStatus()

  return (
    <div className="relative flex min-h-screen items-center justify-center p-8">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.login.title')}</CardTitle>
          <CardDescription>{t('auth.login.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="email" placeholder={t('auth.fields.email')} />
          <Input type="password" placeholder={t('auth.fields.password')} />
          <div className="flex items-center justify-between">
            <Button>{t('auth.login.submit')}</Button>
            {registrationStatus?.allowed && (
              <Button variant="link" asChild>
                <Link to="/register">{t('auth.login.createAccount')}</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
