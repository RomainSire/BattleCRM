import { test } from '@japa/runner'

test.group('User Model', () => {
  test('has uuid primary key typed as string', async ({ assert }) => {
    const { default: User } = await import('#models/user')

    assert.equal(User.primaryKey, 'id')
    assert.isTrue(User.$columnsDefinitions.has('id'))
    assert.isTrue(User.$columnsDefinitions.get('id')?.isPrimary)
  })

  test('has deletedAt column for soft delete', async ({ assert }) => {
    const { default: User } = await import('#models/user')

    assert.isTrue(User.$columnsDefinitions.has('deletedAt'))
  })

  test('has forUser static scope', async ({ assert }) => {
    const { default: User } = await import('#models/user')

    assert.property(User, 'forUser')
  })

  test('has password column hidden from serialization', async ({ assert }) => {
    const { default: User } = await import('#models/user')
    const passwordColumn = User.$columnsDefinitions.get('password')

    assert.isDefined(passwordColumn)
    assert.equal(passwordColumn?.serializeAs, null)
  })
})
