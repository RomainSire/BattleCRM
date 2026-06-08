import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import PasswordResetToken from '#models/password_reset_token'
import User from '#models/user'
import { generateResetToken } from '#services/password_reset_service'

const TEST_EMAIL = 'reset-user@test-reset-password.com'

test.group('POST /api/auth/reset-password', (group) => {
  group.each.setup(async () => {
    await User.create({ email: TEST_EMAIL, password: 'OldPassword1!' })
  })

  group.each.teardown(async () => {
    await User.query().whereILike('email', '%@test-reset-password.com').delete()
  })

  test('resets the password with a valid token and consumes it', async ({ client, assert }) => {
    const user = await User.findByOrFail('email', TEST_EMAIL)
    const rawToken = await generateResetToken(user)

    const response = await client.post('/api/auth/reset-password').json({
      token: rawToken,
      password: 'NewPassword2@',
      passwordConfirmation: 'NewPassword2@',
    })

    response.assertStatus(200)
    assert.equal(response.body().message, 'auth.resetPassword.success')

    // New password works
    const login = await client
      .post('/api/auth/login')
      .json({ email: TEST_EMAIL, password: 'NewPassword2@' })
    login.assertStatus(200)

    // Token consumed (single-use)
    const tokens = await PasswordResetToken.query().where('user_id', user.id)
    assert.lengthOf(tokens, 0)
  })

  test('old password no longer works after reset', async ({ client }) => {
    const user = await User.findByOrFail('email', TEST_EMAIL)
    const rawToken = await generateResetToken(user)

    await client.post('/api/auth/reset-password').json({
      token: rawToken,
      password: 'NewPassword2@',
      passwordConfirmation: 'NewPassword2@',
    })

    const login = await client
      .post('/api/auth/login')
      .json({ email: TEST_EMAIL, password: 'OldPassword1!' })
    login.assertStatus(400)
  })

  test('returns 400 for an expired token', async ({ client }) => {
    const user = await User.findByOrFail('email', TEST_EMAIL)
    const rawToken = await generateResetToken(user)

    const record = await PasswordResetToken.query().where('user_id', user.id).firstOrFail()
    record.expiresAt = DateTime.now().minus({ minutes: 1 })
    await record.save()

    const response = await client.post('/api/auth/reset-password').json({
      token: rawToken,
      password: 'NewPassword2@',
      passwordConfirmation: 'NewPassword2@',
    })

    response.assertStatus(400)
    response.assertBodyContains({
      errors: [{ message: 'auth.resetPassword.invalidToken', rule: 'invalid' }],
    })
  })

  test('returns 400 when the same token is reused (single-use)', async ({ client }) => {
    const user = await User.findByOrFail('email', TEST_EMAIL)
    const rawToken = await generateResetToken(user)

    const first = await client.post('/api/auth/reset-password').json({
      token: rawToken,
      password: 'NewPassword2@',
      passwordConfirmation: 'NewPassword2@',
    })
    first.assertStatus(200)

    const second = await client.post('/api/auth/reset-password').json({
      token: rawToken,
      password: 'AnotherPass3#',
      passwordConfirmation: 'AnotherPass3#',
    })
    second.assertStatus(400)
  })

  test('returns 400 for an unknown token', async ({ client }) => {
    const response = await client.post('/api/auth/reset-password').json({
      token: 'totally-made-up-token',
      password: 'NewPassword2@',
      passwordConfirmation: 'NewPassword2@',
    })

    response.assertStatus(400)
    response.assertBodyContains({
      errors: [{ message: 'auth.resetPassword.invalidToken', rule: 'invalid' }],
    })
  })

  test('returns 422 when the new password is too short', async ({ client, assert }) => {
    const user = await User.findByOrFail('email', TEST_EMAIL)
    const rawToken = await generateResetToken(user)

    const response = await client.post('/api/auth/reset-password').json({
      token: rawToken,
      password: 'short',
      passwordConfirmation: 'short',
    })

    response.assertStatus(422)
    const body = response.body()
    assert.isArray(body.errors)
    assert.equal(body.errors[0].field, 'password')
  })

  test('returns 422 when the confirmation does not match', async ({ client, assert }) => {
    const user = await User.findByOrFail('email', TEST_EMAIL)
    const rawToken = await generateResetToken(user)

    const response = await client.post('/api/auth/reset-password').json({
      token: rawToken,
      password: 'NewPassword2@',
      passwordConfirmation: 'Mismatch3#',
    })

    response.assertStatus(422)
    const body = response.body()
    assert.isArray(body.errors)
    assert.equal(body.errors[0].field, 'passwordConfirmation')
  })
})
