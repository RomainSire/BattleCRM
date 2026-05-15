import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import FunnelStage from '#models/funnel_stage'
import Interaction from '#models/interaction'
import Prospect from '#models/prospect'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-analytics-summary.com'

test.group('Analytics Summary API', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function registerUser(client: ApiClient, prefix: string): Promise<User> {
    const res = await client.post('/api/auth/register').json({
      email: `${prefix}${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    res.assertStatus(201)
    return User.findOrFail(res.body().user.id)
  }

  async function getUserFirstStage(userId: string): Promise<FunnelStage> {
    return FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')
      .firstOrFail()
  }

  async function createProspect(userId: string, stageId: string): Promise<Prospect> {
    return Prospect.create({ userId, funnelStageId: stageId, name: 'Test Prospect' })
  }

  async function createInteraction(
    userId: string,
    prospectId: string,
    stageId: string,
    createdAt?: DateTime,
  ): Promise<Interaction> {
    const interaction = new Interaction()
    interaction.userId = userId
    interaction.prospectId = prospectId
    interaction.funnelStageId = stageId
    interaction.interactionDate = createdAt ?? DateTime.now()
    interaction.notes = 'Test interaction'
    if (createdAt) interaction.createdAt = createdAt
    await interaction.save()
    return interaction
  }

  // ===========================
  // GET /api/analytics/summary
  // ===========================

  test('GET /api/analytics/summary returns correct shape → 200', async ({ client, assert }) => {
    const user = await registerUser(client, 'summary-shape')

    const response = await client.get('/api/analytics/summary').loginAs(user)
    response.assertStatus(200)

    const body = response.body()
    assert.property(body, 'totalActiveProspects')
    assert.property(body, 'prospectsByStage')
    assert.property(body, 'interactionsThisWeek')
    assert.property(body, 'interactionsThisMonth')
    assert.isArray(body.prospectsByStage)
    assert.isNumber(body.totalActiveProspects)
    assert.isNumber(body.interactionsThisWeek)
    assert.isNumber(body.interactionsThisMonth)
  })

  test('totalActiveProspects counts only active (non-archived) prospects', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'summary-active')
    const stage = await getUserFirstStage(user.id)

    const active = await createProspect(user.id, stage.id)
    const archived = await createProspect(user.id, stage.id)
    await archived.delete()

    const response = await client.get('/api/analytics/summary').loginAs(user)
    response.assertStatus(200)

    assert.equal(response.body().totalActiveProspects, 1)
    assert.isDefined(active.id)
  })

  test('prospectsByStage is ordered by funnel stage position and includes all stages', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'summary-stages')

    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    // Create a prospect in the second stage only
    await createProspect(user.id, stages[1].id)

    const response = await client.get('/api/analytics/summary').loginAs(user)
    response.assertStatus(200)

    const byStage: Array<{ stageId: string; stageName: string; count: number }> =
      response.body().prospectsByStage
    assert.isArray(byStage)
    assert.isTrue(byStage.length >= 2, 'Should include all stages')

    // Stage IDs order matches funnel position order
    const returnedIds = byStage.map((s) => s.stageId)
    const expectedIds = stages.map((s) => s.id)
    assert.deepEqual(returnedIds, expectedIds)

    // Stage with prospect has count 1, stage without has count 0
    const stage2Entry = byStage.find((s) => s.stageId === stages[1].id)
    const stage1Entry = byStage.find((s) => s.stageId === stages[0].id)
    assert.equal(stage2Entry?.count, 1)
    assert.equal(stage1Entry?.count, 0)

    // Stage names are included
    assert.equal(byStage[0].stageName, stages[0].name)
  })

  test('interactionsThisWeek counts only interactions from current week', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'summary-week')
    const stage = await getUserFirstStage(user.id)
    const prospect = await createProspect(user.id, stage.id)

    // Interaction this week
    await createInteraction(user.id, prospect.id, stage.id, DateTime.now())
    // Interaction last month (outside this week)
    await createInteraction(user.id, prospect.id, stage.id, DateTime.now().minus({ months: 1 }))

    const response = await client.get('/api/analytics/summary').loginAs(user)
    response.assertStatus(200)

    assert.equal(response.body().interactionsThisWeek, 1)
  })

  test('interactionsThisMonth counts only interactions from current month', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'summary-month')
    const stage = await getUserFirstStage(user.id)
    const prospect = await createProspect(user.id, stage.id)

    // 2 interactions this month
    await createInteraction(user.id, prospect.id, stage.id, DateTime.now())
    await createInteraction(user.id, prospect.id, stage.id, DateTime.now().minus({ days: 5 }))
    // Interaction last month
    await createInteraction(user.id, prospect.id, stage.id, DateTime.now().minus({ months: 1 }))

    const response = await client.get('/api/analytics/summary').loginAs(user)
    response.assertStatus(200)

    assert.equal(response.body().interactionsThisMonth, 2)
  })

  test('returns 401 for unauthenticated request', async ({ client }) => {
    const response = await client.get('/api/analytics/summary')
    response.assertStatus(401)
  })

  test('accepts valid tz parameter and returns correct shape', async ({ client, assert }) => {
    const user = await registerUser(client, 'summary-tz')
    const response = await client.get('/api/analytics/summary?tz=Europe%2FParis').loginAs(user)
    response.assertStatus(200)
    const body = response.body()
    assert.isNumber(body.totalActiveProspects)
    assert.isNumber(body.interactionsThisWeek)
    assert.isNumber(body.interactionsThisMonth)
    assert.isArray(body.prospectsByStage)
  })

  test('falls back to UTC for unknown tz parameter — does not crash', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'summary-tz-invalid')
    const response = await client.get('/api/analytics/summary?tz=Not%2FA%2FTimezone').loginAs(user)
    response.assertStatus(200)
    assert.isNumber(response.body().totalActiveProspects)
  })

  test('user isolation: only counts own data', async ({ client, assert }) => {
    const userA = await registerUser(client, 'summary-iso-a')
    const userB = await registerUser(client, 'summary-iso-b')

    const stageA = await getUserFirstStage(userA.id)
    await createProspect(userA.id, stageA.id)
    await createProspect(userA.id, stageA.id)

    // User B should see 0, not user A's 2 prospects
    const response = await client.get('/api/analytics/summary').loginAs(userB)
    response.assertStatus(200)

    assert.equal(response.body().totalActiveProspects, 0)
  })
})
