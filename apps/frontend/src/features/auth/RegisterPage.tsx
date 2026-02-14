import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TextField } from '@/components/ui/text-field'
import { ApiError } from '@/lib/api'
import { vineResolver } from '@hookform/resolvers/vine'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { useRegister, useRegistrationStatus } from './hooks/useAuth'
import { registerSchema } from './schemas/schemas'

interface RegisterFormValues {
  email: string
  password: string
  passwordConfirmation: string
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { data: registrationStatus, isLoading: isLoadingStatus } = useRegistrationStatus()
  const register = useRegister()

  const form = useForm<RegisterFormValues>({
    resolver: vineResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirmation: '',
    },
  })

  async function onSubmit(data: RegisterFormValues) {
    register.mutate(
      { email: data.email, password: data.password },
      {
        onSuccess: () => navigate('/'),
        onError: (error) => {
          if (error instanceof ApiError) {
            for (const err of error.errors) {
              if (err.field) {
                form.setError(err.field as keyof RegisterFormValues, {
                  message: err.message,
                })
              }
            }
          }
        },
      },
    )
  }

  if (isLoadingStatus) {
    return null
  }

  if (!registrationStatus?.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Registration Disabled</CardTitle>
            <CardDescription>
              Registration is currently disabled. Please contact an administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="link" asChild className="p-0">
              <Link to="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>Create your BattleCRM account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <TextField
              control={form.control}
              name="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
            />

            <TextField
              control={form.control}
              name="password"
              label="Password"
              type="password"
              placeholder="Minimum 8 characters"
            />

            <TextField
              control={form.control}
              name="passwordConfirmation"
              label="Confirm Password"
              type="password"
              placeholder="Repeat your password"
            />

            <div className="flex items-center justify-between">
              <Button type="submit" disabled={register.isPending}>
                {register.isPending ? 'Creating account...' : 'Create account'}
              </Button>
              <Button variant="link" asChild>
                <Link to="/login">Already have an account? Sign in</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
