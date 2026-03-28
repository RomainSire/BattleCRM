import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

/**
 * Test-only controller for E2E test setup.
 * Routes are only registered in non-production environments.
 */
export default class TestController {
  /**
   * DELETE /api/test/reset
   *
   * Hard-deletes ALL data owned by the authenticated user, bypassing soft-deletes.
   * Deletion order respects FK dependencies (interactions → transitions → prospects
   * → positionings → funnel_stages).
   *
   * Use this in E2E `beforeAll` hooks instead of the restore + soft-delete pattern
   * to prevent stale archived records from accumulating across test runs.
   */
  async reset({ auth, response }: HttpContext) {
    const userId = auth.user!.id

    await db.from('interactions').where('user_id', userId).delete()
    await db.from('prospect_stage_transitions').where('user_id', userId).delete()
    await db
      .from('prospect_positionings')
      .whereIn('prospect_id', db.from('prospects').where('user_id', userId).select('id'))
      .delete()
    await db.from('prospects').where('user_id', userId).delete()
    await db.from('positionings').where('user_id', userId).delete()
    await db.from('funnel_stages').where('user_id', userId).delete()

    return response.noContent()
  }
}
