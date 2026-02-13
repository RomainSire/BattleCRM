import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'

/**
 * Sets the PostgreSQL session variable `app.current_user_id` for RLS enforcement.
 *
 * IMPORTANT: With connection pooling, each db.rawQuery() may use a different
 * connection from the pool. This means the set_config call and subsequent
 * model queries may not share the same connection, making RLS enforcement
 * unreliable. The `forUser()` Lucid scope is the PRIMARY user isolation
 * mechanism; RLS is defense-in-depth for when queries happen to reuse
 * the same pooled connection.
 */
export default class SetRlsUserMiddleware {
  async handle({ auth }: HttpContext, next: NextFn) {
    const userId = auth.isAuthenticated ? String(auth.user!.id) : ''

    await db.rawQuery(`SELECT set_config('app.current_user_id', ?, false)`, [userId])

    try {
      return await next()
    } finally {
      await db.rawQuery(`SELECT set_config('app.current_user_id', '', false)`, [])
    }
  }
}
