import { test } from '@japa/runner'
import User from '#models/user'
import env from '#start/env'

test.group('POST /api/auth/register', (group) => {
  group.each.teardown(async () => {
    await User.query().whereILike('email', '%@test-register.com').delete()
  })

  test('returns 403 when registration is disabled', async ({ client, cleanup }) => {
    const original = env.get('ALLOW_REGISTRATION')
    env.set('ALLOW_REGISTRATION', false)
    cleanup(() => env.set('ALLOW_REGISTRATION', original))

    const response = await client.post('/api/auth/register').json({
      email: 'disabled@test-register.com',
      password: 'password123',
    })

    response.assertStatus(403)
    response.assertBodyContains({
      errors: [{ message: 'auth.registrationDisabled.description' }],
    })
  })

  test('creates a user and establishes session with valid data', async ({ client, assert }) => {
    const response = await client.post('/api/auth/register').json({
      email: 'new-user@test-register.com',
      password: 'password123',
    })

    response.assertStatus(201)
    assert.property(response.body(), 'user')
    assert.property(response.body().user, 'id')
    assert.equal(response.body().user.email, 'new-user@test-register.com')

    response.assertCookie('battlecrm_session')
  })

  test('returns 422 when email is already registered', async ({ client }) => {
    await User.create({
      email: 'existing@test-register.com',
      password: 'password123',
    })

    const response = await client.post('/api/auth/register').json({
      email: 'existing@test-register.com',
      password: 'password123',
    })

    response.assertStatus(422)
    response.assertBodyContains({
      errors: [{ message: 'validation.unique', field: 'email', rule: 'unique' }],
    })
  })

  test('returns 422 when email is invalid', async ({ client }) => {
    const response = await client.post('/api/auth/register').json({
      email: 'not-an-email',
      password: 'password123',
    })

    response.assertStatus(422)
  })

  test('returns 422 when password is too short', async ({ client }) => {
    const response = await client.post('/api/auth/register').json({
      email: 'short-pass@test-register.com',
      password: '1234567',
    })

    response.assertStatus(422)
  })
})
