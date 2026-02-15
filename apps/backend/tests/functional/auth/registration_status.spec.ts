import { test } from '@japa/runner'

test.group('GET /api/auth/registration-status', () => {
  test('returns allowed status', async ({ client, assert }) => {
    const response = await client.get('/api/auth/registration-status')

    response.assertStatus(200)
    assert.property(response.body(), 'allowed')
    assert.isBoolean(response.body().allowed)
  })
})
