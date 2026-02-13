import { test } from '@japa/runner'

test.group('SetRlsUserMiddleware', () => {
  test('middleware class has handle method', async ({ assert }) => {
    const { default: SetRlsUserMiddleware } = await import('#middleware/set_rls_user_middleware')

    const middleware = new SetRlsUserMiddleware()
    assert.isFunction(middleware.handle)
  })

  test('middleware is registered as named middleware "rls"', async ({ assert }) => {
    const { middleware } = await import('#start/kernel')

    assert.property(middleware, 'rls')
  })
})
