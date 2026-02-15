import { test } from '@japa/runner'
import User from '#models/user'

test.group('GET /api/auth/me', (group) => {
  group.each.teardown(async () => {
    await User.query().whereILike('email', '%@test-me.com').delete()
  })

  test('returns current user when authenticated', async ({ client, assert }) => {
    const user = await User.create({
      email: 'auth-user@test-me.com',
      password: 'password123',
    })

    const response = await client.get('/api/auth/me').loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().id, user.id)
    assert.equal(response.body().email, user.email)
  })

  test('returns 401 when not authenticated', async ({ client }) => {
    const response = await client.get('/api/auth/me')

    response.assertStatus(401)
  })
})
