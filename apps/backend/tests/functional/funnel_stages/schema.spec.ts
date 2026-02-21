import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import User from '#models/user'
import { DEFAULT_FUNNEL_STAGES } from '#services/funnel_stage_service'

const TEST_EMAIL_DOMAIN = '@test-funnel-schema.com'
const STAGE_COUNT = DEFAULT_FUNNEL_STAGES.length

test.group('FunnelStage schema and default seeding', (group) => {
  // Clean up before the group runs to handle leftover data from previously failed runs
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    // .delete() on query builder executes a raw DELETE (hard-delete, bypasses SoftDeletes mixin)
    // ON DELETE CASCADE on funnel_stages.user_id removes their stages automatically
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  test(`registration creates ${STAGE_COUNT} default funnel stages for new user`, async ({
    client,
    assert,
  }) => {
    const response = await client.post('/api/auth/register').json({
      email: `seed-test${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })

    response.assertStatus(201)
    const userId = response.body().user.id

    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')

    assert.lengthOf(stages, STAGE_COUNT)
    assert.equal(stages[0].name, DEFAULT_FUNNEL_STAGES[0])
    assert.equal(stages[0].position, 1)
    assert.equal(stages[STAGE_COUNT - 1].name, DEFAULT_FUNNEL_STAGES[STAGE_COUNT - 1])
    assert.equal(stages[STAGE_COUNT - 1].position, STAGE_COUNT)
  })

  test('default stages are created in correct order with sequential positions', async ({
    client,
    assert,
  }) => {
    const response = await client.post('/api/auth/register').json({
      email: `order-test${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })

    response.assertStatus(201)
    const userId = response.body().user.id

    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')

    stages.forEach((stage, i) => {
      assert.equal(stage.name, DEFAULT_FUNNEL_STAGES[i], `Stage ${i + 1} name mismatch`)
      assert.equal(stage.position, i + 1, `Stage ${i + 1} position mismatch`)
    })
  })

  test('forUser scope isolates stages between users', async ({ client, assert }) => {
    const resA = await client.post('/api/auth/register').json({
      email: `user-a${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    const resB = await client.post('/api/auth/register').json({
      email: `user-b${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })

    const userAId = resA.body().user.id
    const userBId = resB.body().user.id

    const stagesA = await FunnelStage.query().withScopes((s) => s.forUser(userAId))
    const stagesB = await FunnelStage.query().withScopes((s) => s.forUser(userBId))

    assert.lengthOf(stagesA, STAGE_COUNT)
    assert.lengthOf(stagesB, STAGE_COUNT)
    assert.isTrue(
      stagesA.every((s) => s.userId === userAId),
      'All stages A should belong to user A',
    )
    assert.isTrue(
      stagesB.every((s) => s.userId === userBId),
      'All stages B should belong to user B',
    )
  })

  test('soft-deleted stages are excluded from default queries', async ({ client, assert }) => {
    const response = await client.post('/api/auth/register').json({
      email: `soft-delete-test${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })

    response.assertStatus(201)
    const userId = response.body().user.id

    // Soft-delete the first stage
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .where('position', 1)
      .firstOrFail()
    await stage.delete() // SoftDeletes mixin sets deleted_at

    // Default query should exclude deleted stages
    const activeStages = await FunnelStage.query().withScopes((s) => s.forUser(userId))
    assert.lengthOf(activeStages, STAGE_COUNT - 1)
  })

  test('each funnel stage belongs to the correct user_id', async ({ client, assert }) => {
    const response = await client.post('/api/auth/register').json({
      email: `user-id-test${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })

    response.assertStatus(201)
    const userId = response.body().user.id

    const stages = await FunnelStage.query().withScopes((s) => s.forUser(userId))
    stages.forEach((stage) => {
      assert.equal(stage.userId, userId, 'Stage userId should match registered user')
    })
  })
})
