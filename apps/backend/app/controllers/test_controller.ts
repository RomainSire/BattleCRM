import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { generateResetToken } from '#services/password_reset_service'

/**
 * Test-only controller for E2E test setup.
 * Routes are only registered in non-production environments.
 */
export default class TestController {
  /**
   * POST /api/test/reset-token
   *
   * Mints a raw password-reset token for the given email so the E2E suite can
   * exercise the full reset flow without reading an actual inbox.
   * Creates the user on the fly if it does not exist (idempotent).
   *
   * Guest route — only registered when E2E_TEST_ROUTES_ENABLED === 'true'.
   */
  async createResetToken({ request, response }: HttpContext) {
    const email = request.input('email')
    if (!email) {
      return response.badRequest({ message: 'email is required' })
    }

    let user = await User.findBy('email', email)
    if (!user) {
      user = await User.create({ email, password: 'TempPassword123!' })
    }

    const token = await generateResetToken(user)
    return response.ok({ token })
  }

  /**
   * DELETE /api/test/reset
   *
   * Hard-deletes ALL data owned by the authenticated user, bypassing soft-deletes.
   * Deletion order respects FK dependencies:
   * interactions → prospect_stage_transitions → prospect_positionings
   * → battles → prospects → positionings → funnel_stages
   *
   * When adding a new table with FK toward prospects/positionings/interactions/funnel_stages,
   * insert its deletion BEFORE the referenced parent table.
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
    await db.from('battles').where('user_id', userId).delete()
    await db.from('prospects').where('user_id', userId).delete()
    await db.from('positionings').where('user_id', userId).delete()
    await db.from('funnel_stages').where('user_id', userId).delete()

    return response.noContent()
  }
}
