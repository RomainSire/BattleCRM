import db from '@adonisjs/lucid/services/db'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import FunnelStage from '#models/funnel_stage'
import Interaction from '#models/interaction'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@interactions-schema-test.local'

test.group('Interaction schema', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    // ON DELETE CASCADE on interactions.user_id removes their interactions automatically
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function createUserWithContext(
    client: ApiClient,
    prefix: string,
  ): Promise<{ user: User; stage: FunnelStage; prospect: Prospect }> {
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
    return { user, stage, prospect }
  }

  // ===========================
  // Model creation
  // ===========================

  test('can create an interaction with all fields', async ({ client, assert }) => {
    const { user, stage, prospect } = await createUserWithContext(client, 'create-full')
    const positioning = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Message LinkedIn v1',
    })

    const interaction = await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      status: 'positive',
      notes: 'Great conversation',
      interactionDate: DateTime.now(),
    })

    assert.isDefined(interaction.id)
    assert.equal(interaction.userId, user.id)
    assert.equal(interaction.prospectId, prospect.id)
    assert.equal(interaction.positioningId, positioning.id)
    assert.equal(interaction.funnelStageId, stage.id)
    assert.equal(interaction.status, 'positive')
    assert.equal(interaction.notes, 'Great conversation')
    assert.isDefined(interaction.interactionDate)
    assert.isDefined(interaction.createdAt)
    const reloaded = await Interaction.findOrFail(interaction.id)
    assert.isNull(reloaded.deletedAt)
  })

  test('can create an interaction with minimal fields (no positioning, no notes)', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect } = await createUserWithContext(client, 'create-minimal')

    const interaction = await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'pending',
      interactionDate: DateTime.now(),
    })

    assert.isDefined(interaction.id)
    const reloaded = await Interaction.findOrFail(interaction.id)
    assert.isNull(reloaded.positioningId)
    assert.isNull(reloaded.notes)
    assert.isNull(reloaded.deletedAt)
    assert.equal(reloaded.funnelStageId, stage.id)
  })

  // ===========================
  // forUser scope isolation
  // ===========================

  test('forUser scope isolates interactions between users', async ({ client, assert }) => {
    const {
      user: userA,
      stage: stageA,
      prospect: prospectA,
    } = await createUserWithContext(client, 'isolate-a')
    const {
      user: userB,
      stage: stageB,
      prospect: prospectB,
    } = await createUserWithContext(client, 'isolate-b')

    await Interaction.create({
      userId: userA.id,
      prospectId: prospectA.id,
      funnelStageId: stageA.id,
      status: 'positive',
      interactionDate: DateTime.now(),
    })
    await Interaction.create({
      userId: userB.id,
      prospectId: prospectB.id,
      funnelStageId: stageB.id,
      status: 'negative',
      interactionDate: DateTime.now(),
    })

    const interactionsA = await Interaction.query().withScopes((s) => s.forUser(userA.id))
    const interactionsB = await Interaction.query().withScopes((s) => s.forUser(userB.id))

    assert.lengthOf(interactionsA, 1)
    assert.lengthOf(interactionsB, 1)
    assert.isTrue(interactionsA.every((i) => i.userId === userA.id))
    assert.isTrue(interactionsB.every((i) => i.userId === userB.id))
  })

  test('each interaction belongs to the correct user_id', async ({ client, assert }) => {
    const { user, stage, prospect } = await createUserWithContext(client, 'user-id-check')

    await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'positive',
      interactionDate: DateTime.now(),
    })
    await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'pending',
      interactionDate: DateTime.now(),
    })

    const interactions = await Interaction.query().withScopes((s) => s.forUser(user.id))
    assert.lengthOf(interactions, 2)
    interactions.forEach((i) => {
      assert.equal(i.userId, user.id)
    })
  })

  // ===========================
  // Soft delete
  // ===========================

  test('soft-deleted interactions excluded from default queries', async ({ client, assert }) => {
    const { user, stage, prospect } = await createUserWithContext(client, 'soft-delete')

    const i1 = await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'positive',
      interactionDate: DateTime.now(),
    })
    const i2 = await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'negative',
      interactionDate: DateTime.now(),
    })

    await i2.delete()

    const active = await Interaction.query().withScopes((s) => s.forUser(user.id))
    assert.lengthOf(active, 1)
    assert.equal(active[0].id, i1.id)
  })

  test('withTrashed includes soft-deleted interactions', async ({ client, assert }) => {
    const { user, stage, prospect } = await createUserWithContext(client, 'with-trashed')

    await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'positive',
      interactionDate: DateTime.now(),
    })
    const i2 = await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'pending',
      interactionDate: DateTime.now(),
    })
    await i2.delete()

    const all = await Interaction.query()
      .withTrashed()
      .withScopes((s) => s.forUser(user.id))
    assert.lengthOf(all, 2)
  })

  test('deleted_at is set on soft-delete and null after restore', async ({ client, assert }) => {
    const { user, stage, prospect } = await createUserWithContext(client, 'restore')

    const interaction = await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'positive',
      interactionDate: DateTime.now(),
    })

    await interaction.delete()
    assert.isNotNull(interaction.deletedAt)

    await interaction.restore()
    assert.isNull(interaction.deletedAt)
  })

  // ===========================
  // FK constraints
  // ===========================

  test('interaction.prospectId references an existing prospect', async ({ client, assert }) => {
    const { user, stage, prospect } = await createUserWithContext(client, 'fk-prospect')

    const interaction = await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'positive',
      interactionDate: DateTime.now(),
    })

    assert.equal(interaction.prospectId, prospect.id)
    const reloaded = await Interaction.findOrFail(interaction.id)
    assert.equal(reloaded.prospectId, prospect.id)
  })

  test('interaction.positioningId is nullable (can be null)', async ({ client, assert }) => {
    const { user, stage, prospect } = await createUserWithContext(client, 'fk-null')

    await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'pending',
      interactionDate: DateTime.now(),
    })

    const reloaded = await Interaction.query()
      .withScopes((s) => s.forUser(user.id))
      .firstOrFail()
    assert.isNull(reloaded.positioningId)
  })

  test('cannot create an interaction with a non-existent prospect_id', async ({
    client,
    assert,
  }) => {
    const { user, stage } = await createUserWithContext(client, 'fk-invalid-prospect')

    await assert.rejects(async () => {
      await Interaction.create({
        userId: user.id,
        prospectId: '00000000-0000-0000-0000-000000000000',
        funnelStageId: stage.id,
        status: 'positive',
        interactionDate: DateTime.now(),
      })
    })
  })

  test('ON DELETE CASCADE: hard-deleting a user removes their interactions', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect } = await createUserWithContext(client, 'cascade-user')

    const interaction = await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'positive',
      interactionDate: DateTime.now(),
    })
    const interactionId = interaction.id

    // Bypass SoftDeletes — hard delete pour déclencher la contrainte CASCADE
    await db.from('users').where('id', user.id).delete()

    const found = await Interaction.query().withTrashed().where('id', interactionId).first()
    assert.isNull(found)
  })

  test('ON DELETE SET NULL: hard-deleting a positioning nullifies interaction.positioningId', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect } = await createUserWithContext(client, 'fk-cascade')

    const positioning = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'ToHardDelete',
    })

    const interaction = await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      status: 'positive',
      interactionDate: DateTime.now(),
    })

    // Bypass SoftDeletes — hard delete pour déclencher la contrainte DB
    await db.from('positionings').where('id', positioning.id).delete()

    const reloaded = await Interaction.findOrFail(interaction.id)
    assert.isNull(reloaded.positioningId)
  })
})
