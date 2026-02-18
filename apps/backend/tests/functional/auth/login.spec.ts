import { test } from '@japa/runner'
import User from '#models/user'

test.group('POST /api/auth/login', (group) => {
  group.setup(async () => {
    await User.create({
      email: 'login-user@test-login.com',
      password: 'password123',
    })
  })

  group.teardown(async () => {
    await User.query().whereILike('email', '%@test-login.com').delete()
  })

  test('authenticates user and establishes session with valid credentials', async ({
    client,
    assert,
  }) => {
    const response = await client.post('/api/auth/login').json({
      email: 'login-user@test-login.com',
      password: 'password123',
    })

    response.assertStatus(200)
    assert.property(response.body(), 'user')
    assert.property(response.body().user, 'id')
    assert.equal(response.body().user.email, 'login-user@test-login.com')
    response.assertCookie('battlecrm_session')
  })

  test('returns 400 with wrong password', async ({ client }) => {
    const response = await client.post('/api/auth/login').json({
      email: 'login-user@test-login.com',
      password: 'wrongpassword',
    })

    response.assertStatus(400)
    response.assertBodyContains({
      errors: [{ message: 'auth.login.invalidCredentials' }],
    })
  })

  test('returns 400 with non-existent email', async ({ client }) => {
    const response = await client.post('/api/auth/login').json({
      email: 'nobody@test-login.com',
      password: 'password123',
    })

    response.assertStatus(400)
    response.assertBodyContains({
      errors: [{ message: 'auth.login.invalidCredentials' }],
    })
  })

  test('returns 422 with invalid email format', async ({ client, assert }) => {
    const response = await client.post('/api/auth/login').json({
      email: 'not-an-email',
      password: 'password123',
    })

    response.assertStatus(422)
    const body = response.body()
    assert.property(body, 'errors')
    assert.isArray(body.errors)
    assert.isNotEmpty(body.errors)
    assert.equal(body.errors[0].field, 'email')
  })

  test('returns 422 with missing fields', async ({ client, assert }) => {
    const response = await client.post('/api/auth/login').json({})

    response.assertStatus(422)
    const body = response.body()
    assert.property(body, 'errors')
    assert.isArray(body.errors)
    assert.isAbove(body.errors.length, 0)
  })

  test('redirects when already logged in (guest middleware)', async ({ client }) => {
    const user = await User.findByOrFail('email', 'login-user@test-login.com')

    const response = await client.post('/api/auth/login').loginAs(user).redirects(0).json({
      email: 'login-user@test-login.com',
      password: 'password123',
    })

    response.assertStatus(302)
  })
})
