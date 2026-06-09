import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Battle from '#models/battle'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-battles-cancel.com'

test.group('DELETE /api/battles/:id', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function setupUser(client: ApiClient, prefix: string) {
    const res = await client.post('/api/auth/register').json({
      email: `${prefix}${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    res.assertStatus(201)
    const userId = res.body().user.id
    const user = await User.findOrFail(userId)
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')
      .firstOrFail()
    const positioningA = await Positioning.create({
      userId,
      funnelStageId: stage.id,
      name: 'Variant A',
    })
    const positioningB = await Positioning.create({
      userId,
      funnelStageId: stage.id,
      name: 'Variant B',
    })
    return { user, stage, positioningA, positioningB }
  }

  async function createActiveBattle(
    userId: string,
    stageId: string,
    variantAId: string,
    variantBId: string,
    battleNumber = 1,
  ) {
    return Battle.create({
      userId,
      funnelStageId: stageId,
      variantAId,
      variantBId,
      battleNumber,
      status: 'active',
      winnerId: null,
      startedAt: DateTime.now(),
      closedAt: null,
    })
  }

  // ===========================
  // Authentication
  // ===========================

  test('unauthenticated request returns 401', async ({ client }) => {
    const res = await client.delete('/api/battles/00000000-0000-0000-0000-000000000000')
    res.assertStatus(401)
  })

  // ===========================
  // Happy path
  // ===========================

  test('deletes an active battle and removes the row from the database', async ({
    client,
    assert,
  }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'cancel-happy')
    const battle = await createActiveBattle(user.id, stage.id, positioningA.id, positioningB.id)

    const res = await client.delete(`/api/battles/${battle.id}`).loginAs(user)

    res.assertStatus(200)
    assert.isDefined(res.body().message)

    const reloaded = await Battle.find(battle.id)
    assert.isNull(reloaded)
  })

  test('cancels an active battle regardless of significance (no data)', async ({
    client,
    assert,
  }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'cancel-no-data')
    const battle = await createActiveBattle(user.id, stage.id, positioningA.id, positioningB.id)

    const res = await client.delete(`/api/battles/${battle.id}`).loginAs(user)

    res.assertStatus(200)
    assert.isNull(await Battle.find(battle.id))
  })

  test('frees the battleNumber so the next battle reuses it', async ({ client, assert }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'cancel-free-num')

    // Battle #1 closed, Battle #2 active.
    await Battle.create({
      userId: user.id,
      funnelStageId: stage.id,
      variantAId: positioningA.id,
      variantBId: positioningB.id,
      battleNumber: 1,
      status: 'closed',
      winnerId: positioningA.id,
      startedAt: DateTime.now(),
      closedAt: DateTime.now(),
    })
    const battle2 = await createActiveBattle(user.id, stage.id, positioningA.id, positioningB.id, 2)

    const cancelRes = await client.delete(`/api/battles/${battle2.id}`).loginAs(user)
    cancelRes.assertStatus(200)

    // Starting a new battle reuses number 2 (freed by the cancellation).
    const startRes = await client.post('/api/battles').loginAs(user).json({
      funnel_stage_id: stage.id,
      variant_a_id: positioningA.id,
      variant_b_id: positioningB.id,
    })
    startRes.assertStatus(201)
    assert.equal(startRes.body().battleNumber, 2)
  })

  // ===========================
  // Business rule violations
  // ===========================

  test('cancelling an already-closed battle returns 422', async ({ client }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'cancel-closed')
    const closedBattle = await Battle.create({
      userId: user.id,
      funnelStageId: stage.id,
      variantAId: positioningA.id,
      variantBId: positioningB.id,
      battleNumber: 1,
      status: 'closed',
      winnerId: positioningA.id,
      startedAt: DateTime.now(),
      closedAt: DateTime.now(),
    })

    const res = await client.delete(`/api/battles/${closedBattle.id}`).loginAs(user)
    res.assertStatus(422)
  })

  // ===========================
  // Not found / bad request
  // ===========================

  test('unknown battle id returns 404', async ({ client }) => {
    const { user } = await setupUser(client, 'cancel-not-found')

    const res = await client
      .delete('/api/battles/00000000-0000-0000-0000-000000000099')
      .loginAs(user)
    res.assertStatus(404)
  })

  test('invalid uuid id returns 404 (route constraint rejects non-UUID path params)', async ({
    client,
  }) => {
    const { user } = await setupUser(client, 'cancel-bad-uuid')

    const res = await client.delete('/api/battles/not-a-uuid').loginAs(user)
    res.assertStatus(404)
  })

  // ===========================
  // User isolation
  // ===========================

  test('user B cannot cancel user A battle', async ({ client, assert }) => {
    const {
      user: userA,
      stage,
      positioningA,
      positioningB,
    } = await setupUser(client, 'cancel-iso-a')
    const { user: userB } = await setupUser(client, 'cancel-iso-b')
    const battle = await createActiveBattle(userA.id, stage.id, positioningA.id, positioningB.id)

    const res = await client.delete(`/api/battles/${battle.id}`).loginAs(userB)
    res.assertStatus(404)

    // Battle still exists — not touched by user B.
    assert.isNotNull(await Battle.find(battle.id))
  })
})
