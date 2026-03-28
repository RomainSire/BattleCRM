import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import ProspectPositioning from '#models/prospect_positioning'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@prospect-positionings-schema-test.local'

test.group('ProspectPositioning schema', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    // ON DELETE CASCADE on prospect_positionings.user_id removes records automatically
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function createUserWithContext(
    client: ApiClient,
    prefix: string,
  ): Promise<{
    user: User
    stage: FunnelStage
    prospect: Prospect
    positioning: Positioning
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
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: `${prefix} Prospect`,
    })
    const positioning = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: `${prefix} Positioning`,
    })
    return { user, stage, prospect, positioning }
  }

  // ===========================
  // Model creation
  // ===========================

  test('can create a ProspectPositioning with all required fields', async ({ client, assert }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(client, 'create')

    const pp = await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })

    assert.isDefined(pp.id)
    assert.equal(pp.userId, user.id)
    assert.equal(pp.prospectId, prospect.id)
    assert.equal(pp.positioningId, positioning.id)
    assert.equal(pp.funnelStageId, stage.id)
    assert.isNull(pp.outcome)
    assert.isDefined(pp.createdAt)
  })

  // ===========================
  // outcome values
  // ===========================

  test('outcome can be set to success', async ({ client, assert }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'outcome-success',
    )

    const pp = await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: 'success',
    })

    const reloaded = await ProspectPositioning.findOrFail(pp.id)
    assert.equal(reloaded.outcome, 'success')
  })

  test('outcome can be set to failed', async ({ client, assert }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'outcome-failed',
    )

    const pp = await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: 'failed',
    })

    const reloaded = await ProspectPositioning.findOrFail(pp.id)
    assert.equal(reloaded.outcome, 'failed')
  })

  test('outcome can be updated from null to success', async ({ client, assert }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'outcome-update',
    )

    const pp = await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })

    pp.outcome = 'success'
    await pp.save()

    const reloaded = await ProspectPositioning.findOrFail(pp.id)
    assert.equal(reloaded.outcome, 'success')
  })

  // ===========================
  // forUser scope isolation
  // ===========================

  test('forUser scope isolates ProspectPositionings between users', async ({ client, assert }) => {
    const {
      user: userA,
      stage: stageA,
      prospect: prospectA,
      positioning: positioningA,
    } = await createUserWithContext(client, 'isolate-a')
    const {
      user: userB,
      stage: stageB,
      prospect: prospectB,
      positioning: positioningB,
    } = await createUserWithContext(client, 'isolate-b')

    await ProspectPositioning.create({
      userId: userA.id,
      prospectId: prospectA.id,
      positioningId: positioningA.id,
      funnelStageId: stageA.id,
      outcome: null,
    })
    await ProspectPositioning.create({
      userId: userB.id,
      prospectId: prospectB.id,
      positioningId: positioningB.id,
      funnelStageId: stageB.id,
      outcome: null,
    })

    const ppA = await ProspectPositioning.query().withScopes((s) => s.forUser(userA.id))
    const ppB = await ProspectPositioning.query().withScopes((s) => s.forUser(userB.id))

    assert.lengthOf(ppA, 1)
    assert.lengthOf(ppB, 1)
    assert.isTrue(ppA.every((p) => p.userId === userA.id))
    assert.isTrue(ppB.every((p) => p.userId === userB.id))
  })

  // ===========================
  // UNIQUE constraint
  // ===========================

  test('UNIQUE constraint prevents duplicate (user_id, prospect_id, funnel_stage_id)', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'unique-constraint',
    )

    // First insert succeeds
    await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })

    // Second insert with same (user_id, prospect_id, funnel_stage_id) must throw
    await assert.rejects(async () => {
      await ProspectPositioning.create({
        userId: user.id,
        prospectId: prospect.id,
        positioningId: positioning.id,
        funnelStageId: stage.id,
        outcome: null,
      })
    })
  })

  // ===========================
  // Replace pattern (delete + insert)
  // ===========================

  test('replacing positioning for same stage via delete+insert works correctly', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(client, 'replace-pp')
    const positioning2 = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'replace-pp Positioning 2',
    })

    // Initial assignment
    await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })

    // Replace: hard delete old, create new
    await ProspectPositioning.query()
      .where('user_id', user.id)
      .where('prospect_id', prospect.id)
      .where('funnel_stage_id', stage.id)
      .delete()

    await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning2.id,
      funnelStageId: stage.id,
      outcome: null,
    })

    // Only one record exists for this (user, prospect, stage)
    const records = await ProspectPositioning.query()
      .where('prospect_id', prospect.id)
      .where('funnel_stage_id', stage.id)
    assert.lengthOf(records, 1)
    assert.equal(records[0].positioningId, positioning2.id)
  })

  // ===========================
  // CASCADE constraints
  // ===========================

  test('ON DELETE CASCADE: hard-deleting a user removes their ProspectPositionings', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'cascade-user',
    )

    const pp = await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })
    const ppId = pp.id

    // Bypass SoftDeletes — hard delete to trigger CASCADE
    await db.from('users').where('id', user.id).delete()

    const found = await ProspectPositioning.query().where('id', ppId).first()
    assert.isNull(found)
  })

  // ===========================
  // Active positioning derivation
  // ===========================

  test('active positioning is derived by matching funnel_stage_id to prospect current stage', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'active-positioning',
    )

    // Get a second stage for testing historical records
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })

    // Active positioning query: WHERE prospect_id = X AND funnel_stage_id = prospect.funnel_stage_id
    const active = await ProspectPositioning.query()
      .where('prospect_id', prospect.id)
      .where('funnel_stage_id', prospect.funnelStageId) // same as stage.id
      .first()

    assert.isNotNull(active)
    assert.equal(active!.positioningId, positioning.id)

    // If prospect moves to a different stage, active positioning would be null (no record for new stage)
    if (stages.length > 1) {
      const otherStage = stages.find((s) => s.id !== stage.id)!
      const activeForOtherStage = await ProspectPositioning.query()
        .where('prospect_id', prospect.id)
        .where('funnel_stage_id', otherStage.id)
        .first()
      assert.isNull(activeForOtherStage)
    }
  })

  // ===========================
  // Interaction funnelStageId snapshot
  // ===========================

  test('interaction funnelStageId is stored as immutable snapshot', async ({ client, assert }) => {
    const { user, stage, prospect } = await createUserWithContext(client, 'interaction-snapshot')
    const { DateTime } = await import('luxon')
    const Interaction = (await import('#models/interaction')).default

    // Create interaction — funnelStageId captures prospect's current stage
    const interaction = await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      interactionDate: DateTime.now(),
    })

    const reloaded = await Interaction.findOrFail(interaction.id)
    assert.equal(reloaded.funnelStageId, stage.id)

    // Get another stage — simulate prospect moving to a new stage
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    if (stages.length > 1) {
      const newStage = stages.find((s) => s.id !== stage.id)!
      // Update prospect's current stage (simulate a move)
      prospect.funnelStageId = newStage.id
      await prospect.save()

      // Interaction's funnelStageId must remain unchanged (it's a snapshot)
      const interactionAfterMove = await Interaction.findOrFail(interaction.id)
      assert.equal(interactionAfterMove.funnelStageId, stage.id) // still old stage
    }
  })
})
