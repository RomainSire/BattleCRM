import { test } from '@japa/runner'
import User from '#models/user'

test.group('PUT /api/auth/password', (group) => {
  group.each.setup(async () => {
    await User.create({
      email: 'pwd-user@test-change-password.com',
      password: 'OldPassword1!',
    })
  })

  group.each.teardown(async () => {
    await User.query().whereILike('email', '%@test-change-password.com').delete()
  })

  test('changes password successfully with valid data', async ({ client, assert }) => {
    const user = await User.findByOrFail('email', 'pwd-user@test-change-password.com')

    const response = await client.put('/api/auth/password').loginAs(user).json({
      currentPassword: 'OldPassword1!',
      newPassword: 'NewPassword2@',
      newPasswordConfirmation: 'NewPassword2@',
    })

    response.assertStatus(200)
    assert.equal(response.body().message, 'Password changed')
  })

  test('new password works for login after change', async ({ client }) => {
    const user = await User.findByOrFail('email', 'pwd-user@test-change-password.com')

    await client.put('/api/auth/password').loginAs(user).json({
      currentPassword: 'OldPassword1!',
      newPassword: 'NewPassword2@',
      newPasswordConfirmation: 'NewPassword2@',
    })

    const loginResponse = await client.post('/api/auth/login').json({
      email: 'pwd-user@test-change-password.com',
      password: 'NewPassword2@',
    })

    loginResponse.assertStatus(200)
  })

  test('old password no longer works after change', async ({ client }) => {
    const user = await User.findByOrFail('email', 'pwd-user@test-change-password.com')

    await client.put('/api/auth/password').loginAs(user).json({
      currentPassword: 'OldPassword1!',
      newPassword: 'NewPassword2@',
      newPasswordConfirmation: 'NewPassword2@',
    })

    const loginResponse = await client.post('/api/auth/login').json({
      email: 'pwd-user@test-change-password.com',
      password: 'OldPassword1!',
    })

    loginResponse.assertStatus(400)
  })

  test('returns 400 with wrong current password', async ({ client }) => {
    const user = await User.findByOrFail('email', 'pwd-user@test-change-password.com')

    const response = await client.put('/api/auth/password').loginAs(user).json({
      currentPassword: 'WrongPassword!',
      newPassword: 'NewPassword2@',
      newPasswordConfirmation: 'NewPassword2@',
    })

    response.assertStatus(400)
    response.assertBodyContains({
      errors: [
        {
          message: 'auth.changePassword.invalidCurrentPassword',
          field: 'currentPassword',
          rule: 'invalid',
        },
      ],
    })
  })

  test('returns 422 when newPassword is too short', async ({ client, assert }) => {
    const user = await User.findByOrFail('email', 'pwd-user@test-change-password.com')

    const response = await client.put('/api/auth/password').loginAs(user).json({
      currentPassword: 'OldPassword1!',
      newPassword: 'short',
      newPasswordConfirmation: 'short',
    })

    response.assertStatus(422)
    const body = response.body()
    assert.isArray(body.errors)
    assert.isNotEmpty(body.errors)
    assert.equal(body.errors[0].field, 'newPassword')
  })

  test('returns 422 when newPasswordConfirmation does not match', async ({ client, assert }) => {
    const user = await User.findByOrFail('email', 'pwd-user@test-change-password.com')

    const response = await client.put('/api/auth/password').loginAs(user).json({
      currentPassword: 'OldPassword1!',
      newPassword: 'NewPassword2@',
      newPasswordConfirmation: 'DifferentPassword3#',
    })

    response.assertStatus(422)
    const body = response.body()
    assert.isArray(body.errors)
    assert.isNotEmpty(body.errors)
    assert.equal(body.errors[0].field, 'newPasswordConfirmation')
  })

  test('returns 422 when required fields are missing', async ({ client, assert }) => {
    const user = await User.findByOrFail('email', 'pwd-user@test-change-password.com')

    const response = await client.put('/api/auth/password').loginAs(user).json({})

    response.assertStatus(422)
    const body = response.body()
    assert.isArray(body.errors)
    assert.isAbove(body.errors.length, 0)
  })

  test('returns 401 when not authenticated', async ({ client }) => {
    const response = await client.put('/api/auth/password').json({
      currentPassword: 'OldPassword1!',
      newPassword: 'NewPassword2@',
      newPasswordConfirmation: 'NewPassword2@',
    })

    response.assertStatus(401)
  })
})
