import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Battle from '#models/battle'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-battles-store.com'

test.group('POST /api/battles', (group) => {
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

  // ===========================
  // Authentication
  // ===========================

  test('unauthenticated request returns 401', async ({ client }) => {
    const res = await client.post('/api/battles').json({})
    res.assertStatus(401)
  })

  // ===========================
  // Happy path
  // ===========================

  test('creates battle with battleNumber = 1 for first battle on stage', async ({
    client,
    assert,
  }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'store-first')

    const res = await client.post('/api/battles').loginAs(user).json({
      funnel_stage_id: stage.id,
      variant_a_id: positioningA.id,
      variant_b_id: positioningB.id,
    })

    res.assertStatus(201)
    const body = res.body()
    assert.equal(body.battleNumber, 1)
    assert.equal(body.status, 'active')
    assert.equal(body.funnelStageId, stage.id)
    assert.equal(body.variantAId, positioningA.id)
    assert.equal(body.variantBId, positioningB.id)
    assert.isNull(body.winnerId)
    assert.isNull(body.closedAt)
    assert.isDefined(body.id)
    assert.isDefined(body.startedAt)
  })

  test('creates battle with battleNumber = 2 after previous battle closed', async ({
    client,
    assert,
  }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'store-second')

    // Create and close the first battle
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

    const res = await client.post('/api/battles').loginAs(user).json({
      funnel_stage_id: stage.id,
      variant_a_id: positioningA.id,
      variant_b_id: positioningB.id,
    })

    res.assertStatus(201)
    assert.equal(res.body().battleNumber, 2)
    assert.equal(res.body().status, 'active')
  })

  // ===========================
  // Validation errors
  // ===========================

  test('same variant for A and B returns 422', async ({ client }) => {
    const { user, stage, positioningA } = await setupUser(client, 'store-same-variant')

    const res = await client.post('/api/battles').loginAs(user).json({
      funnel_stage_id: stage.id,
      variant_a_id: positioningA.id,
      variant_b_id: positioningA.id,
    })

    res.assertStatus(422)
  })

  test('invalid uuid fields return 422', async ({ client }) => {
    const { user } = await setupUser(client, 'store-invalid-uuid')

    const res = await client.post('/api/battles').loginAs(user).json({
      funnel_stage_id: 'not-a-uuid',
      variant_a_id: 'not-a-uuid',
      variant_b_id: 'not-a-uuid',
    })

    res.assertStatus(422)
  })

  // ===========================
  // Ownership
  // ===========================

  test('funnel_stage_id not owned by user returns 404', async ({ client }) => {
    const { user: userA } = await setupUser(client, 'store-stage-iso-a')
    const {
      stage: stageB,
      positioningA,
      positioningB,
    } = await setupUser(client, 'store-stage-iso-b')

    const res = await client.post('/api/battles').loginAs(userA).json({
      funnel_stage_id: stageB.id,
      variant_a_id: positioningA.id,
      variant_b_id: positioningB.id,
    })

    res.assertStatus(404)
  })

  test('variant_a_id not owned by user returns 404', async ({ client }) => {
    const { user: userA, stage } = await setupUser(client, 'store-va-iso-a')
    const { positioningA: foreignP } = await setupUser(client, 'store-va-iso-b')
    const ownP = await Positioning.create({
      userId: userA.id,
      funnelStageId: stage.id,
      name: 'Own B',
    })

    const res = await client.post('/api/battles').loginAs(userA).json({
      funnel_stage_id: stage.id,
      variant_a_id: foreignP.id,
      variant_b_id: ownP.id,
    })

    res.assertStatus(404)
  })

  test('variant_b_id not owned by user returns 404', async ({ client }) => {
    const { user: userA, stage, positioningA } = await setupUser(client, 'store-vb-iso-a')
    const { positioningB: foreignP } = await setupUser(client, 'store-vb-iso-b')

    const res = await client.post('/api/battles').loginAs(userA).json({
      funnel_stage_id: stage.id,
      variant_a_id: positioningA.id,
      variant_b_id: foreignP.id,
    })

    res.assertStatus(404)
  })

  // ===========================
  // Uniqueness constraint
  // ===========================

  test('creating a second active battle for same stage returns 409', async ({ client }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'store-conflict')

    // Create first active battle
    await client.post('/api/battles').loginAs(user).json({
      funnel_stage_id: stage.id,
      variant_a_id: positioningA.id,
      variant_b_id: positioningB.id,
    })

    // Attempt second active battle on same stage
    const res = await client.post('/api/battles').loginAs(user).json({
      funnel_stage_id: stage.id,
      variant_a_id: positioningA.id,
      variant_b_id: positioningB.id,
    })

    res.assertStatus(409)
  })

  test('user A active battle does not block user B from starting a battle on same stage position', async ({
    client,
    assert,
  }) => {
    const {
      user: userA,
      stage: stageA,
      positioningA: pAa,
      positioningB: pAb,
    } = await setupUser(client, 'store-iso-conflict-a')
    const {
      user: userB,
      stage: stageB,
      positioningA: pBa,
      positioningB: pBb,
    } = await setupUser(client, 'store-iso-conflict-b')

    // User A starts a battle
    await client.post('/api/battles').loginAs(userA).json({
      funnel_stage_id: stageA.id,
      variant_a_id: pAa.id,
      variant_b_id: pAb.id,
    })

    // User B should still be able to start a battle (user isolation)
    const res = await client.post('/api/battles').loginAs(userB).json({
      funnel_stage_id: stageB.id,
      variant_a_id: pBa.id,
      variant_b_id: pBb.id,
    })

    res.assertStatus(201)
    assert.equal(res.body().status, 'active')
  })
})
