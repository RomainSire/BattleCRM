import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Battle from '#models/battle'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-battles-schema.com'

test.group('Battle schema', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    // ON DELETE CASCADE on battles.user_id removes their battles automatically
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function createUserWithStageAndPositionings(
    client: ApiClient,
    prefix: string,
  ): Promise<{
    user: User
    stage: FunnelStage
    positioningA: Positioning
    positioningB: Positioning
  }> {
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
  // Model creation
  // ===========================

  test('can create a battle with all required fields', async ({ client, assert }) => {
    const { user, stage, positioningA, positioningB } = await createUserWithStageAndPositionings(
      client,
      'create-required',
    )

    const battle = await Battle.create({
      userId: user.id,
      funnelStageId: stage.id,
      variantAId: positioningA.id,
      variantBId: positioningB.id,
      battleNumber: 1,
      status: 'active',
      startedAt: DateTime.now(),
    })

    assert.isDefined(battle.id)
    assert.equal(battle.userId, user.id)
    assert.equal(battle.funnelStageId, stage.id)
    assert.equal(battle.variantAId, positioningA.id)
    assert.equal(battle.variantBId, positioningB.id)
    assert.equal(battle.battleNumber, 1)
    assert.equal(battle.status, 'active')
    assert.isDefined(battle.createdAt)

    const reloaded = await Battle.findOrFail(battle.id)
    assert.isNull(reloaded.winnerId)
    assert.isNull(reloaded.closedAt)
  })

  test('can create a closed battle with winner and closed_at', async ({ client, assert }) => {
    const { user, stage, positioningA, positioningB } = await createUserWithStageAndPositionings(
      client,
      'create-closed',
    )

    const battle = await Battle.create({
      userId: user.id,
      funnelStageId: stage.id,
      variantAId: positioningA.id,
      variantBId: positioningB.id,
      battleNumber: 1,
      status: 'closed',
      startedAt: DateTime.now().minus({ days: 7 }),
      winnerId: positioningA.id,
      closedAt: DateTime.now(),
    })

    const reloaded = await Battle.findOrFail(battle.id)
    assert.equal(reloaded.status, 'closed')
    assert.equal(reloaded.winnerId, positioningA.id)
    assert.isNotNull(reloaded.closedAt)
  })

  // ===========================
  // forUser scope isolation
  // ===========================

  test('forUser scope isolates battles between users', async ({ client, assert }) => {
    const {
      user: userA,
      stage: stageA,
      positioningA: pA1,
      positioningB: pA2,
    } = await createUserWithStageAndPositionings(client, 'isolate-a')
    const {
      user: userB,
      stage: stageB,
      positioningA: pB1,
      positioningB: pB2,
    } = await createUserWithStageAndPositionings(client, 'isolate-b')

    await Battle.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      variantAId: pA1.id,
      variantBId: pA2.id,
      battleNumber: 1,
      status: 'active',
      startedAt: DateTime.now(),
    })
    await Battle.create({
      userId: userB.id,
      funnelStageId: stageB.id,
      variantAId: pB1.id,
      variantBId: pB2.id,
      battleNumber: 1,
      status: 'active',
      startedAt: DateTime.now(),
    })

    const battlesA = await Battle.query().withScopes((s) => s.forUser(userA.id))
    const battlesB = await Battle.query().withScopes((s) => s.forUser(userB.id))

    assert.lengthOf(battlesA, 1)
    assert.lengthOf(battlesB, 1)
    assert.isTrue(battlesA.every((b) => b.userId === userA.id))
    assert.isTrue(battlesB.every((b) => b.userId === userB.id))
  })

  // ===========================
  // Partial unique constraint
  // ===========================

  test('partial unique: two active battles for same (user, stage) are rejected', async ({
    client,
    assert,
  }) => {
    const { user, stage, positioningA, positioningB } = await createUserWithStageAndPositionings(
      client,
      'unique-active',
    )

    await Battle.create({
      userId: user.id,
      funnelStageId: stage.id,
      variantAId: positioningA.id,
      variantBId: positioningB.id,
      battleNumber: 1,
      status: 'active',
      startedAt: DateTime.now(),
    })

    await assert.rejects(
      () =>
        Battle.create({
          userId: user.id,
          funnelStageId: stage.id,
          variantAId: positioningB.id,
          variantBId: positioningA.id,
          battleNumber: 2,
          status: 'active',
          startedAt: DateTime.now(),
        }),
      /unique/i,
    )
  })

  test('two active battles for same user but different stages are allowed', async ({
    client,
    assert,
  }) => {
    const {
      user,
      stage: stage1,
      positioningA,
      positioningB,
    } = await createUserWithStageAndPositionings(client, 'multi-stage')

    // Get a second stage for this user — registration creates 3 default stages, assert to fail fast if that changes
    const allStages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')
    const stage2 = allStages[1]
    assert.isDefined(stage2, 'Expected at least 2 default funnel stages for new user')

    const b1 = await Battle.create({
      userId: user.id,
      funnelStageId: stage1.id,
      variantAId: positioningA.id,
      variantBId: positioningB.id,
      battleNumber: 1,
      status: 'active',
      startedAt: DateTime.now(),
    })

    // Same user, different stage — should succeed
    const b2 = await Battle.create({
      userId: user.id,
      funnelStageId: stage2.id,
      variantAId: positioningA.id,
      variantBId: positioningB.id,
      battleNumber: 1,
      status: 'active',
      startedAt: DateTime.now(),
    })

    assert.isDefined(b1.id)
    assert.isDefined(b2.id)
    assert.notEqual(b1.id, b2.id)
  })

  test('active + closed battles for same (user, stage) are allowed', async ({ client, assert }) => {
    const { user, stage, positioningA, positioningB } = await createUserWithStageAndPositionings(
      client,
      'active-plus-closed',
    )

    // closed battle first
    await Battle.create({
      userId: user.id,
      funnelStageId: stage.id,
      variantAId: positioningA.id,
      variantBId: positioningB.id,
      battleNumber: 1,
      status: 'closed',
      startedAt: DateTime.now().minus({ days: 7 }),
      winnerId: positioningA.id,
      closedAt: DateTime.now().minus({ days: 1 }),
    })

    // active battle — partial index only prevents two 'active' rows
    const activeBattle = await Battle.create({
      userId: user.id,
      funnelStageId: stage.id,
      variantAId: positioningB.id,
      variantBId: positioningA.id,
      battleNumber: 2,
      status: 'active',
      startedAt: DateTime.now(),
    })

    assert.isDefined(activeBattle.id)

    const allBattles = await Battle.query().withScopes((s) => s.forUser(user.id))
    assert.lengthOf(allBattles, 2)
    const statuses = allBattles.map((b) => b.status).sort()
    assert.deepEqual(statuses, ['active', 'closed'])
  })

  // ===========================
  // battle_number storage
  // ===========================

  test('battle_number is stored and retrieved correctly', async ({ client, assert }) => {
    const { user, stage, positioningA, positioningB } = await createUserWithStageAndPositionings(
      client,
      'battle-number',
    )

    const battle = await Battle.create({
      userId: user.id,
      funnelStageId: stage.id,
      variantAId: positioningA.id,
      variantBId: positioningB.id,
      battleNumber: 42,
      status: 'active',
      startedAt: DateTime.now(),
    })

    const reloaded = await Battle.findOrFail(battle.id)
    assert.equal(reloaded.battleNumber, 42)
  })
})
