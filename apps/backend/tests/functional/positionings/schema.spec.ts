import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-positionings-schema.com'

test.group('Positioning schema', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    // ON DELETE CASCADE on positionings.user_id removes their positionings automatically
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function createUserWithStage(
    client: ApiClient,
    prefix: string,
  ): Promise<{ user: User; stage: FunnelStage }> {
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
    return { user, stage }
  }

  // ===========================
  // Model creation
  // ===========================

  test('can create a positioning with all fields', async ({ client, assert }) => {
    const { user, stage } = await createUserWithStage(client, 'create-full')

    const positioning = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'CV v2 - React Focus',
      description: 'Highlighting React experience for frontend roles',
      content: 'Full CV content here',
    })

    assert.isDefined(positioning.id)
    assert.equal(positioning.userId, user.id)
    assert.equal(positioning.funnelStageId, stage.id)
    assert.equal(positioning.name, 'CV v2 - React Focus')
    assert.equal(positioning.description, 'Highlighting React experience for frontend roles')
    assert.equal(positioning.content, 'Full CV content here')
    assert.isDefined(positioning.createdAt)
    const reloadedFull = await Positioning.findOrFail(positioning.id)
    assert.isNull(reloadedFull.deletedAt)
  })

  test('can create a positioning with only required fields', async ({ client, assert }) => {
    const { user, stage } = await createUserWithStage(client, 'create-minimal')

    const positioning = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'CV minimal',
    })

    assert.isDefined(positioning.id)
    const reloaded = await Positioning.findOrFail(positioning.id)
    assert.isNull(reloaded.description)
    assert.isNull(reloaded.content)
    assert.isNull(reloaded.deletedAt)
  })

  // ===========================
  // forUser scope isolation
  // ===========================

  test('forUser scope isolates positionings between users', async ({ client, assert }) => {
    const { user: userA, stage: stageA } = await createUserWithStage(client, 'isolate-a')
    const { user: userB, stage: stageB } = await createUserWithStage(client, 'isolate-b')

    await Positioning.create({ userId: userA.id, funnelStageId: stageA.id, name: 'A-variant' })
    await Positioning.create({ userId: userB.id, funnelStageId: stageB.id, name: 'B-variant' })

    const positioningsA = await Positioning.query().withScopes((s) => s.forUser(userA.id))
    const positioningsB = await Positioning.query().withScopes((s) => s.forUser(userB.id))

    assert.lengthOf(positioningsA, 1)
    assert.lengthOf(positioningsB, 1)
    assert.isTrue(positioningsA.every((p) => p.userId === userA.id))
    assert.isTrue(positioningsB.every((p) => p.userId === userB.id))
  })

  test('each positioning belongs to the correct user_id', async ({ client, assert }) => {
    const { user, stage } = await createUserWithStage(client, 'user-id-check')

    await Positioning.create({ userId: user.id, funnelStageId: stage.id, name: 'P1' })
    await Positioning.create({ userId: user.id, funnelStageId: stage.id, name: 'P2' })

    const positionings = await Positioning.query().withScopes((s) => s.forUser(user.id))
    assert.lengthOf(positionings, 2)
    positionings.forEach((p) => {
      assert.equal(p.userId, user.id)
    })
  })

  // ===========================
  // Soft delete
  // ===========================

  test('soft-deleted positionings excluded from default queries', async ({ client, assert }) => {
    const { user, stage } = await createUserWithStage(client, 'soft-delete')

    const p1 = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Active',
    })
    const p2 = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'ToDelete',
    })

    await p2.delete() // SoftDeletes mixin — sets deleted_at

    const active = await Positioning.query().withScopes((s) => s.forUser(user.id))
    assert.lengthOf(active, 1)
    assert.equal(active[0].id, p1.id)
  })

  test('withTrashed includes soft-deleted positionings', async ({ client, assert }) => {
    const { user, stage } = await createUserWithStage(client, 'with-trashed')

    await Positioning.create({ userId: user.id, funnelStageId: stage.id, name: 'Active' })
    const p2 = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Deleted',
    })
    await p2.delete()

    const all = await Positioning.query()
      .withTrashed()
      .withScopes((s) => s.forUser(user.id))
    assert.lengthOf(all, 2)
  })

  test('deleted_at is set on soft-delete and null on restore', async ({ client, assert }) => {
    const { user, stage } = await createUserWithStage(client, 'restore')

    const positioning = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'ToRestore',
    })

    await positioning.delete()
    assert.isNotNull(positioning.deletedAt)

    await positioning.restore()
    assert.isNull(positioning.deletedAt)
  })
})
