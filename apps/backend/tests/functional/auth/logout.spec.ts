import { test } from '@japa/runner'
import User from '#models/user'

test.group('POST /api/auth/logout', (group) => {
  group.setup(async () => {
    await User.create({
      email: 'logout-user@test-logout.com',
      password: 'password123',
    })
  })

  group.teardown(async () => {
    await User.query().whereILike('email', '%@test-logout.com').delete()
  })

  test('destroys session and returns 200 for authenticated user', async ({ client }) => {
    const user = await User.findByOrFail('email', 'logout-user@test-logout.com')

    const response = await client.post('/api/auth/logout').loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({ message: 'Logged out' })
  })

  test('returns 401 when not authenticated', async ({ client }) => {
    const response = await client.post('/api/auth/logout')

    response.assertStatus(401)
  })

  test('protected route returns 401 without session', async ({ client }) => {
    const response = await client.get('/api/auth/me')

    response.assertStatus(401)
  })
})
