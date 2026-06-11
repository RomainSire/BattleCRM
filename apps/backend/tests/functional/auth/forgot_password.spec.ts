import mail from '@adonisjs/mail/services/main'
import { test } from '@japa/runner'
import ResetPasswordNotification from '#mails/reset_password_notification'
import PasswordResetToken from '#models/password_reset_token'
import User from '#models/user'

const TEST_EMAIL = 'forgot-user@test-forgot-password.com'

test.group('POST /api/auth/forgot-password', (group) => {
  let fakeMailer: ReturnType<typeof mail.fake>

  group.each.setup(async () => {
    fakeMailer = mail.fake()
    await User.create({ email: TEST_EMAIL, password: 'OldPassword1!' })
  })

  group.each.teardown(async () => {
    mail.restore()
    await User.query().whereILike('email', '%@test-forgot-password.com').delete()
  })

  test('returns 200 and sends a reset email for an existing account', async ({
    client,
    assert,
  }) => {
    const response = await client.post('/api/auth/forgot-password').json({ email: TEST_EMAIL })

    response.assertStatus(200)
    assert.equal(response.body().message, 'auth.forgotPassword.emailSent')

    const user = await User.findByOrFail('email', TEST_EMAIL)
    const tokens = await PasswordResetToken.query().where('user_id', user.id)
    assert.lengthOf(tokens, 1)

    fakeMailer.mails.assertSentCount(ResetPasswordNotification, 1)
  })

  test('returns 200 but sends nothing for an unknown account (anti-enumeration)', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/api/auth/forgot-password')
      .json({ email: 'nobody@test-forgot-password.com' })

    response.assertStatus(200)
    assert.equal(response.body().message, 'auth.forgotPassword.emailSent')

    const tokens = await PasswordResetToken.all()
    assert.lengthOf(tokens, 0)

    fakeMailer.mails.assertNoneSent()
  })

  test('keeps a single active token when requested twice', async ({ client, assert }) => {
    await client.post('/api/auth/forgot-password').json({ email: TEST_EMAIL })
    await client.post('/api/auth/forgot-password').json({ email: TEST_EMAIL })

    const user = await User.findByOrFail('email', TEST_EMAIL)
    const tokens = await PasswordResetToken.query().where('user_id', user.id)
    assert.lengthOf(tokens, 1)
  })

  test('returns 422 for an invalid email format', async ({ client }) => {
    const response = await client.post('/api/auth/forgot-password').json({ email: 'not-an-email' })

    response.assertStatus(422)
  })

  test('sends the email in French when locale is "fr"', async ({ client }) => {
    await client.post('/api/auth/forgot-password').json({ email: TEST_EMAIL, locale: 'fr' })

    fakeMailer.mails.assertSent(ResetPasswordNotification, (mail) => {
      mail.message.assertSubject('Réinitialisation de votre mot de passe BattleCRM')
      return true
    })
  })

  test('sends the email in English when locale is "en"', async ({ client }) => {
    await client.post('/api/auth/forgot-password').json({ email: TEST_EMAIL, locale: 'en' })

    fakeMailer.mails.assertSent(ResetPasswordNotification, (mail) => {
      mail.message.assertSubject('Reset your BattleCRM password')
      return true
    })
  })

  test('sends the email in Japanese when locale is "ja"', async ({ client }) => {
    await client.post('/api/auth/forgot-password').json({ email: TEST_EMAIL, locale: 'ja' })

    fakeMailer.mails.assertSent(ResetPasswordNotification, (mail) => {
      mail.message.assertSubject('BattleCRM のパスワード再設定')
      return true
    })
  })

  test('falls back to English when no locale is provided', async ({ client }) => {
    await client.post('/api/auth/forgot-password').json({ email: TEST_EMAIL })

    fakeMailer.mails.assertSent(ResetPasswordNotification, (mail) => {
      mail.message.assertSubject('Reset your BattleCRM password')
      return true
    })
  })

  test('returns 422 for an unsupported locale', async ({ client }) => {
    const response = await client
      .post('/api/auth/forgot-password')
      .json({ email: TEST_EMAIL, locale: 'de' })

    response.assertStatus(422)
  })
})
