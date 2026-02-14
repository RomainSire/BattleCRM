import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useRegistrationStatus } from './hooks/useAuth'

export function LoginPage() {
  const { data: registrationStatus } = useRegistrationStatus()

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Sign in to BattleCRM</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="email" placeholder="Email" />
          <Input type="password" placeholder="Password" />
          <div className="flex items-center justify-between">
            <Button>Sign In</Button>
            {registrationStatus?.allowed && (
              <Button variant="link" asChild>
                <Link to="/register">Create an account</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
