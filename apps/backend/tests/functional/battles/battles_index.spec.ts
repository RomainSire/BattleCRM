import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Battle from '#models/battle'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-battles-index.com'

test.group('GET /api/battles', (group) => {
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

  async function createBattle(
    userId: string,
    stageId: string,
    variantAId: string,
    variantBId: string,
    battleNumber: number,
    status: 'active' | 'closed' = 'active',
    winnerId: string | null = null,
  ) {
    return Battle.create({
      userId,
      funnelStageId: stageId,
      variantAId,
      variantBId,
      battleNumber,
      status,
      winnerId,
      startedAt: DateTime.now(),
      closedAt: status === 'closed' ? DateTime.now() : null,
    })
  }

  // ===========================
  // Authentication
  // ===========================

  test('unauthenticated request returns 401', async ({ client }) => {
    const res = await client.get('/api/battles')
    res.assertStatus(401)
  })

  // ===========================
  // Empty list
  // ===========================

  test('no battles → returns empty data array', async ({ client, assert }) => {
    const { user } = await setupUser(client, 'empty-battles')

    const res = await client.get('/api/battles').loginAs(user)
    res.assertStatus(200)
    assert.deepEqual(res.body(), { data: [] })
  })

  // ===========================
  // User isolation
  // ===========================

  test('user A cannot see user B battles', async ({ client, assert }) => {
    const {
      user: userA,
      stage: stageA,
      positioningA: pA,
      positioningB: pB,
    } = await setupUser(client, 'iso-a-battles')
    const { user: userB } = await setupUser(client, 'iso-b-battles')

    await createBattle(userA.id, stageA.id, pA.id, pB.id, 1)

    const res = await client.get('/api/battles').loginAs(userB)
    res.assertStatus(200)
    assert.deepEqual(res.body().data, [])
  })

  // ===========================
  // Basic list
  // ===========================

  test('returns battles for authenticated user', async ({ client, assert }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'list-battles')

    await createBattle(user.id, stage.id, positioningA.id, positioningB.id, 1, 'active')

    const res = await client.get('/api/battles').loginAs(user)
    res.assertStatus(200)
    const body = res.body()
    assert.equal(body.data.length, 1)
    assert.equal(body.data[0].battleNumber, 1)
    assert.equal(body.data[0].status, 'active')
    assert.equal(body.data[0].funnelStageId, stage.id)
  })

  // ===========================
  // Filter by funnel_stage_id
  // ===========================

  test('filter by funnel_stage_id returns only battles for that stage', async ({
    client,
    assert,
  }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'filter-battles')

    // Create a second stage
    const stage2 = await FunnelStage.create({ userId: user.id, name: 'Stage 2', position: 99 })
    const pC = await Positioning.create({ userId: user.id, funnelStageId: stage2.id, name: 'C' })
    const pD = await Positioning.create({ userId: user.id, funnelStageId: stage2.id, name: 'D' })

    await createBattle(user.id, stage.id, positioningA.id, positioningB.id, 1)
    await createBattle(user.id, stage2.id, pC.id, pD.id, 1)

    const res = await client.get(`/api/battles?funnel_stage_id=${stage.id}`).loginAs(user)
    res.assertStatus(200)
    const data = res.body().data
    assert.equal(data.length, 1)
    assert.equal(data[0].funnelStageId, stage.id)
  })

  // ===========================
  // Invalid UUID param
  // ===========================

  test('invalid funnel_stage_id format returns 400', async ({ client }) => {
    const { user } = await setupUser(client, 'invalid-uuid-battles')

    const res = await client.get('/api/battles?funnel_stage_id=not-a-uuid').loginAs(user)
    res.assertStatus(400)
  })

  // ===========================
  // Sort order
  // ===========================

  test('battles ordered by battle_number DESC within stage', async ({ client, assert }) => {
    const { user, stage, positioningA, positioningB } = await setupUser(client, 'sort-battles')

    await createBattle(
      user.id,
      stage.id,
      positioningA.id,
      positioningB.id,
      1,
      'closed',
      positioningA.id,
    )
    await createBattle(user.id, stage.id, positioningA.id, positioningB.id, 2, 'active')

    const res = await client.get('/api/battles').loginAs(user)
    res.assertStatus(200)
    const data = res.body().data
    assert.equal(data.length, 2)
    assert.equal(data[0].battleNumber, 2)
    assert.equal(data[1].battleNumber, 1)
  })
})
