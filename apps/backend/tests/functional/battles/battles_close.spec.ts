import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Battle from '#models/battle'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-battles-close.com'

test.group('PATCH /api/battles/:id/close', (group) => {
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
  ) {
    return Battle.create({
      userId,
      funnelStageId: stageId,
      variantAId,
      variantBId,
      battleNumber: 1,
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
    const res = await client.patch('/api/battles/00000000-0000-0000-0000-000000000000/close').json({
      winner_id: '00000000-0000-0000-0000-000000000001',
    })
    res.assertStatus(401)
  })

  // ===========================
  // Happy path
  // ===========================

  test('closes an active battle with winner_id = variantA', async ({ client, assert }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'close-happy-a')
    const battle = await createActiveBattle(user.id, stage.id, positioningA.id, positioningB.id)

    const res = await client
      .patch(`/api/battles/${battle.id}/close`)
      .loginAs(user)
      .json({ winner_id: positioningA.id })

    res.assertStatus(200)
    const body = res.body()
    assert.equal(body.status, 'closed')
    assert.equal(body.winnerId, positioningA.id)
    assert.isNotNull(body.closedAt)
    assert.equal(body.id, battle.id)
  })

  test('closes an active battle with winner_id = variantB', async ({ client, assert }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'close-happy-b')
    const battle = await createActiveBattle(user.id, stage.id, positioningA.id, positioningB.id)

    const res = await client
      .patch(`/api/battles/${battle.id}/close`)
      .loginAs(user)
      .json({ winner_id: positioningB.id })

    res.assertStatus(200)
    const body = res.body()
    assert.equal(body.status, 'closed')
    assert.equal(body.winnerId, positioningB.id)
    assert.isNotNull(body.closedAt)
  })

  // ===========================
  // Business rule violations
  // ===========================

  test('closing an already-closed battle returns 422', async ({ client }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(
      client,
      'close-already-closed',
    )
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

    const res = await client
      .patch(`/api/battles/${closedBattle.id}/close`)
      .loginAs(user)
      .json({ winner_id: positioningA.id })

    res.assertStatus(422)
  })

  test('winner_id not a variant of the battle returns 422', async ({ client }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'close-bad-winner')
    const battle = await createActiveBattle(user.id, stage.id, positioningA.id, positioningB.id)
    const outsider = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Outsider',
    })

    const res = await client
      .patch(`/api/battles/${battle.id}/close`)
      .loginAs(user)
      .json({ winner_id: outsider.id })

    res.assertStatus(422)
  })

  test('missing winner_id returns 422', async ({ client }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(
      client,
      'close-missing-winner',
    )
    const battle = await createActiveBattle(user.id, stage.id, positioningA.id, positioningB.id)

    const res = await client.patch(`/api/battles/${battle.id}/close`).loginAs(user).json({})

    res.assertStatus(422)
  })

  // ===========================
  // Not found / bad request
  // ===========================

  test('unknown battle id returns 404', async ({ client }) => {
    const { user } = await setupUser(client, 'close-not-found')

    const res = await client
      .patch('/api/battles/00000000-0000-0000-0000-000000000099/close')
      .loginAs(user)
      .json({ winner_id: '00000000-0000-0000-0000-000000000001' })

    res.assertStatus(404)
  })

  test('invalid uuid id returns 404 (route constraint rejects non-UUID path params)', async ({
    client,
  }) => {
    const { user } = await setupUser(client, 'close-bad-uuid')

    const res = await client
      .patch('/api/battles/not-a-uuid/close')
      .loginAs(user)
      .json({ winner_id: '00000000-0000-0000-0000-000000000001' })

    res.assertStatus(404)
  })

  // ===========================
  // User isolation
  // ===========================

  test('user B cannot close user A battle', async ({ client }) => {
    const {
      user: userA,
      stage,
      positioningA,
      positioningB,
    } = await setupUser(client, 'close-iso-a')
    const { user: userB } = await setupUser(client, 'close-iso-b')
    const battle = await createActiveBattle(userA.id, stage.id, positioningA.id, positioningB.id)

    const res = await client
      .patch(`/api/battles/${battle.id}/close`)
      .loginAs(userB)
      .json({ winner_id: positioningA.id })

    res.assertStatus(404)
  })
})
