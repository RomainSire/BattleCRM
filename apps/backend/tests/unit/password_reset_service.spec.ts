import { test } from '@japa/runner'
import { hashToken } from '#services/password_reset_service'

test.group('hashToken()', () => {
  test('is deterministic for the same input', ({ assert }) => {
    assert.equal(hashToken('some-raw-token'), hashToken('some-raw-token'))
  })

  test('produces a 64-char hex SHA-256 digest', ({ assert }) => {
    const hash = hashToken('some-raw-token')
    assert.match(hash, /^[a-f0-9]{64}$/)
  })

  test('produces different hashes for different inputs', ({ assert }) => {
    assert.notEqual(hashToken('token-a'), hashToken('token-b'))
  })

  test('never returns the raw token as-is', ({ assert }) => {
    assert.notEqual(hashToken('raw'), 'raw')
  })
})
