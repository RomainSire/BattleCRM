import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-extension-auth.com'

async function createUser(email: string): Promise<User> {
  return User.create({ email, password: 'password123' })
}

test.group('Extension auth', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  // ===========================
  // POST /api/extension/auth/login
  // ===========================

  test('returns 200 with token and user on valid credentials', async ({ client, assert }) => {
    await createUser(`login-valid${TEST_EMAIL_DOMAIN}`)

    const response = await client.post('/api/extension/auth/login').json({
      email: `login-valid${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })

    response.assertStatus(200)
    const body = response.body()
    assert.isString(body.token)
    assert.isNotEmpty(body.token)
    assert.property(body, 'user')
    assert.isString(body.user.id)
    assert.equal(body.user.email, `login-valid${TEST_EMAIL_DOMAIN}`)
  })

  test('token starts with oat_ prefix', async ({ client, assert }) => {
    await createUser(`login-prefix${TEST_EMAIL_DOMAIN}`)

    const response = await client.post('/api/extension/auth/login').json({
      email: `login-prefix${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })

    response.assertStatus(200)
    assert.isTrue(response.body().token.startsWith('oat_'))
  })

  test('stores token with default name "Extension" when name not provided', async ({
    client,
    assert,
  }) => {
    const user = await createUser(`login-defaultname${TEST_EMAIL_DOMAIN}`)

    const response = await client.post('/api/extension/auth/login').json({
      email: `login-defaultname${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })

    response.assertStatus(200)
    const row = await db.from('auth_access_tokens').where('tokenable_id', user.id).first()
    assert.equal(row.name, 'Extension')
  })

  test('stores token with custom name when name is provided', async ({ client, assert }) => {
    const user = await createUser(`login-customname${TEST_EMAIL_DOMAIN}`)

    const response = await client.post('/api/extension/auth/login').json({
      email: `login-customname${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
      name: 'Mon Chrome',
    })

    response.assertStatus(200)
    const row = await db.from('auth_access_tokens').where('tokenable_id', user.id).first()
    assert.equal(row.name, 'Mon Chrome')
  })

  test('returns 401 on wrong password', async ({ client, assert }) => {
    await createUser(`login-wrongpwd${TEST_EMAIL_DOMAIN}`)

    const response = await client.post('/api/extension/auth/login').json({
      email: `login-wrongpwd${TEST_EMAIL_DOMAIN}`,
      password: 'wrongpassword',
    })

    response.assertStatus(401)
    assert.equal(response.body().message, 'Invalid credentials')
  })

  test('returns 401 on unknown email', async ({ client, assert }) => {
    const response = await client.post('/api/extension/auth/login').json({
      email: `nobody${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })

    response.assertStatus(401)
    assert.equal(response.body().message, 'Invalid credentials')
  })

  test('returns 422 on missing fields', async ({ client, assert }) => {
    const response = await client.post('/api/extension/auth/login').json({})

    response.assertStatus(422)
    assert.isArray(response.body().errors)
    assert.isNotEmpty(response.body().errors)
  })

  test('returns 422 on invalid email format', async ({ client, assert }) => {
    const response = await client.post('/api/extension/auth/login').json({
      email: 'not-an-email',
      password: 'password123',
    })

    response.assertStatus(422)
    const errors = response.body().errors
    assert.isTrue(errors.some((e: { field: string }) => e.field === 'email'))
  })

  // ===========================
  // Bearer token authentication
  // ===========================

  test('authenticated request with valid Bearer token succeeds', async ({ client }) => {
    await createUser(`bearer-valid${TEST_EMAIL_DOMAIN}`)

    const loginRes = await client.post('/api/extension/auth/login').json({
      email: `bearer-valid${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    const { token } = loginRes.body()

    const response = await client
      .post('/api/extension/auth/logout')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(200)
  })

  test('authenticated request with invalid Bearer token returns 401', async ({ client }) => {
    const response = await client
      .post('/api/extension/auth/logout')
      .header('Authorization', 'Bearer oat_invalidtoken')

    response.assertStatus(401)
  })

  test('authenticated request without Authorization header returns 401', async ({ client }) => {
    const response = await client.post('/api/extension/auth/logout')

    response.assertStatus(401)
  })

  // ===========================
  // POST /api/extension/auth/logout
  // ===========================

  test('logout deletes token and subsequent request returns 401', async ({ client }) => {
    await createUser(`logout-valid${TEST_EMAIL_DOMAIN}`)

    const loginRes = await client.post('/api/extension/auth/login').json({
      email: `logout-valid${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    const { token } = loginRes.body()

    const logoutRes = await client
      .post('/api/extension/auth/logout')
      .header('Authorization', `Bearer ${token}`)
    logoutRes.assertStatus(200)

    // Same token is now invalid
    const secondLogout = await client
      .post('/api/extension/auth/logout')
      .header('Authorization', `Bearer ${token}`)
    secondLogout.assertStatus(401)
  })

  test('returns 401 for expired token', async ({ client }) => {
    const user = await createUser(`expired-token${TEST_EMAIL_DOMAIN}`)

    const loginRes = await client.post('/api/extension/auth/login').json({
      email: `expired-token${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    const { token } = loginRes.body()

    // Force-expire the token by backdating expires_at
    await db
      .from('auth_access_tokens')
      .where('tokenable_id', user.id)
      .update({ expires_at: DateTime.now().minus({ days: 1 }).toSQL() })

    const response = await client
      .post('/api/extension/auth/logout')
      .header('Authorization', `Bearer ${token}`)

    response.assertStatus(401)
  })

  // TODO (AC4): last_used_at update cannot be tested functionally without a read-only
  // protected extension endpoint. Will be testable in Story 7.x when such an endpoint exists.

  test('multiple tokens can coexist for the same user', async ({ client, assert }) => {
    await createUser(`multi-token${TEST_EMAIL_DOMAIN}`)

    const login1 = await client.post('/api/extension/auth/login').json({
      email: `multi-token${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
      name: 'Token 1',
    })
    const login2 = await client.post('/api/extension/auth/login').json({
      email: `multi-token${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
      name: 'Token 2',
    })

    assert.notEqual(login1.body().token, login2.body().token)

    // Both tokens are valid
    const logout1 = await client
      .post('/api/extension/auth/logout')
      .header('Authorization', `Bearer ${login1.body().token}`)
    logout1.assertStatus(200)

    // Token 2 still valid after token 1 is revoked
    const logout2 = await client
      .post('/api/extension/auth/logout')
      .header('Authorization', `Bearer ${login2.body().token}`)
    logout2.assertStatus(200)
  })
})
