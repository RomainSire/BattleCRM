import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import ProspectPositioning from '#models/prospect_positioning'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@prospect-positionings-api-test.local'

test.group('ProspectPositionings API', (group) => {
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
  // POST /api/prospects/:id/positionings — assign
  // ===========================

  test('POST /api/prospects/:id/positionings returns 201 with ProspectPositioningType', async ({
    client,
    assert,
  }) => {
    const { user, prospect, positioning } = await createUserWithContext(client, 'assign-201')

    const response = await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: positioning.id })
      .loginAs(user)

    response.assertStatus(201)
    const body = response.body()
    assert.equal(body.prospectId, prospect.id)
    assert.equal(body.positioningId, positioning.id)
    assert.isNull(body.outcome)
    assert.isDefined(body.id)
    assert.isDefined(body.createdAt)
  })

  test('POST /api/prospects/:id/positionings replace: reassigning same stage deletes old and creates new', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'assign-replace',
    )
    const positioning2 = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'assign-replace Positioning 2',
    })

    // First assignment
    await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: positioning.id })
      .loginAs(user)

    // Set outcome on the first record
    await client
      .patch(`/api/prospects/${prospect.id}/positionings/current/outcome`)
      .json({ outcome: 'success' })
      .loginAs(user)

    // Reassign with a different positioning for the same stage
    const response = await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: positioning2.id })
      .loginAs(user)

    response.assertStatus(201)
    assert.equal(response.body().positioningId, positioning2.id)
    assert.isNull(response.body().outcome) // outcome reset to null

    // Only one record should exist for this (user, prospect, stage)
    const records = await ProspectPositioning.query()
      .where('user_id', user.id)
      .where('prospect_id', prospect.id)
      .where('funnel_stage_id', stage.id)
    assert.lengthOf(records, 1)
    assert.equal(records[0].positioningId, positioning2.id)
  })

  test('POST /api/prospects/:id/positionings returns 422 with missing positioning_id', async ({
    client,
  }) => {
    const { user, prospect } = await createUserWithContext(client, 'assign-missing')

    const response = await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({})
      .loginAs(user)

    response.assertStatus(422)
  })

  test('POST /api/prospects/:id/positionings returns 422 with non-UUID positioning_id', async ({
    client,
  }) => {
    const { user, prospect } = await createUserWithContext(client, 'assign-bad-uuid')

    const response = await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: 'not-a-uuid' })
      .loginAs(user)

    response.assertStatus(422)
  })

  test('POST /api/prospects/:id/positionings returns 404 for non-existent prospect', async ({
    client,
  }) => {
    const { user, positioning } = await createUserWithContext(client, 'assign-404-prospect')
    const fakeId = '00000000-0000-0000-0000-000000000001'

    const response = await client
      .post(`/api/prospects/${fakeId}/positionings`)
      .json({ positioning_id: positioning.id })
      .loginAs(user)

    response.assertStatus(404)
  })

  test('POST /api/prospects/:id/positionings returns 404 for prospect belonging to another user', async ({
    client,
  }) => {
    const { prospect } = await createUserWithContext(client, 'assign-isolation-a')
    const { user: userB, positioning: posB } = await createUserWithContext(
      client,
      'assign-isolation-b',
    )

    const response = await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: posB.id })
      .loginAs(userB)

    response.assertStatus(404)
  })

  test('POST /api/prospects/:id/positionings returns 404 for archived positioning', async ({
    client,
  }) => {
    const { user, prospect, positioning } = await createUserWithContext(
      client,
      'assign-archived-pos',
    )

    // Archive the positioning
    await client.delete(`/api/positionings/${positioning.id}`).loginAs(user)

    const response = await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: positioning.id })
      .loginAs(user)

    response.assertStatus(404)
  })

  test('POST /api/prospects/:id/positionings returns 404 for archived prospect', async ({
    client,
  }) => {
    const { user, prospect, positioning } = await createUserWithContext(
      client,
      'assign-archived-pros',
    )

    // Archive the prospect
    await client.delete(`/api/prospects/${prospect.id}`).loginAs(user)

    const response = await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: positioning.id })
      .loginAs(user)

    response.assertStatus(404)
  })

  test('POST /api/prospects/:id/positionings returns 401 without authentication', async ({
    client,
  }) => {
    const { prospect, positioning } = await createUserWithContext(client, 'assign-401')

    const response = await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: positioning.id })

    response.assertStatus(401)
  })

  // ===========================
  // PATCH /api/prospects/:id/positionings/current/outcome
  // ===========================

  test('PATCH /api/prospects/:id/positionings/current/outcome returns 200 with outcome success', async ({
    client,
    assert,
  }) => {
    const { user, prospect, positioning } = await createUserWithContext(client, 'outcome-success')

    // Assign first
    await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: positioning.id })
      .loginAs(user)

    const response = await client
      .patch(`/api/prospects/${prospect.id}/positionings/current/outcome`)
      .json({ outcome: 'success' })
      .loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.outcome, 'success')
    assert.equal(body.prospectId, prospect.id)
    assert.equal(body.positioningId, positioning.id)
  })

  test('PATCH /api/prospects/:id/positionings/current/outcome returns 200 with outcome failed', async ({
    client,
    assert,
  }) => {
    const { user, prospect, positioning } = await createUserWithContext(client, 'outcome-failed')

    await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: positioning.id })
      .loginAs(user)

    const response = await client
      .patch(`/api/prospects/${prospect.id}/positionings/current/outcome`)
      .json({ outcome: 'failed' })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().outcome, 'failed')
  })

  test('PATCH /api/prospects/:id/positionings/current/outcome returns 404 when no active positioning', async ({
    client,
  }) => {
    const { user, prospect } = await createUserWithContext(client, 'outcome-no-pp')

    const response = await client
      .patch(`/api/prospects/${prospect.id}/positionings/current/outcome`)
      .json({ outcome: 'success' })
      .loginAs(user)

    response.assertStatus(404)
  })

  test('PATCH /api/prospects/:id/positionings/current/outcome returns 422 with invalid outcome', async ({
    client,
  }) => {
    const { user, prospect, positioning } = await createUserWithContext(client, 'outcome-invalid')

    await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: positioning.id })
      .loginAs(user)

    const response = await client
      .patch(`/api/prospects/${prospect.id}/positionings/current/outcome`)
      .json({ outcome: 'pending' })
      .loginAs(user)

    response.assertStatus(422)
  })

  test('PATCH /api/prospects/:id/positionings/current/outcome returns 404 for non-existent prospect', async ({
    client,
  }) => {
    const { user } = await createUserWithContext(client, 'outcome-404')
    const fakeId = '00000000-0000-0000-0000-000000000002'

    const response = await client
      .patch(`/api/prospects/${fakeId}/positionings/current/outcome`)
      .json({ outcome: 'success' })
      .loginAs(user)

    response.assertStatus(404)
  })

  test('PATCH /api/prospects/:id/positionings/current/outcome returns 404 for other user prospect', async ({
    client,
  }) => {
    const { prospect } = await createUserWithContext(client, 'outcome-isolation-a')
    const { user: userB } = await createUserWithContext(client, 'outcome-isolation-b')

    const response = await client
      .patch(`/api/prospects/${prospect.id}/positionings/current/outcome`)
      .json({ outcome: 'success' })
      .loginAs(userB)

    response.assertStatus(404)
  })

  test('PATCH /api/prospects/:id/positionings/current/outcome returns 401 without authentication', async ({
    client,
  }) => {
    const { prospect } = await createUserWithContext(client, 'outcome-401')

    const response = await client
      .patch(`/api/prospects/${prospect.id}/positionings/current/outcome`)
      .json({ outcome: 'success' })

    response.assertStatus(401)
  })

  // ===========================
  // GET /api/prospects/:id/positionings — index
  // ===========================

  test('GET /api/prospects/:id/positionings returns 200 with empty list', async ({
    client,
    assert,
  }) => {
    const { user, prospect } = await createUserWithContext(client, 'index-empty')

    const response = await client.get(`/api/prospects/${prospect.id}/positionings`).loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.isArray(body.data)
    assert.lengthOf(body.data, 0)
    assert.equal(body.meta.total, 0)
  })

  test('GET /api/prospects/:id/positionings returns correct shape with ProspectPositioningDetailType', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'index-shape',
    )

    await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })

    const response = await client.get(`/api/prospects/${prospect.id}/positionings`).loginAs(user)

    response.assertStatus(200)
    const { data, meta } = response.body()
    assert.lengthOf(data, 1)
    assert.equal(meta.total, 1)

    const item = data[0]
    assert.isDefined(item.id)
    assert.equal(item.positioningId, positioning.id)
    assert.equal(item.positioningName, positioning.name)
    assert.equal(item.funnelStageId, stage.id)
    assert.isString(item.funnelStageName)
    assert.isNull(item.outcome)
    assert.isDefined(item.createdAt)
    assert.isBoolean(item.isActive)
  })

  test('GET /api/prospects/:id/positionings isActive=true for current stage pp', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'index-active',
    )

    await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })

    const response = await client.get(`/api/prospects/${prospect.id}/positionings`).loginAs(user)

    response.assertStatus(200)
    const item = response.body().data[0]
    // prospect.funnelStageId === stage.id → isActive should be true
    assert.isTrue(item.isActive)
  })

  test('GET /api/prospects/:id/positionings isActive=false for historical stage pp', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'index-inactive',
    )

    // Get a second stage
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    assert.isAbove(stages.length, 1, 'Expected at least 2 funnel stages in test setup')

    const otherStage = stages.find((s) => s.id !== stage.id)!
    const positioning2 = await Positioning.create({
      userId: user.id,
      funnelStageId: otherStage.id,
      name: 'index-inactive Positioning 2',
    })

    // Create pp for the other stage (historical — prospect is currently on stage, not otherStage)
    await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning2.id,
      funnelStageId: otherStage.id,
      outcome: null,
    })

    // Also create current stage pp
    await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })

    const response = await client.get(`/api/prospects/${prospect.id}/positionings`).loginAs(user)

    response.assertStatus(200)
    const data = response.body().data

    const currentPp = data.find(
      (item: { funnelStageId: string }) => item.funnelStageId === stage.id,
    )
    const historicalPp = data.find(
      (item: { funnelStageId: string }) => item.funnelStageId === otherStage.id,
    )

    assert.isTrue(currentPp.isActive)
    assert.isFalse(historicalPp.isActive)
  })

  test('GET /api/prospects/:id/positionings returns 404 for non-existent prospect', async ({
    client,
  }) => {
    const { user } = await createUserWithContext(client, 'index-404')
    const fakeId = '00000000-0000-0000-0000-000000000003'

    const response = await client.get(`/api/prospects/${fakeId}/positionings`).loginAs(user)

    response.assertStatus(404)
  })

  test('GET /api/prospects/:id/positionings returns 404 for other user prospect', async ({
    client,
  }) => {
    const { prospect } = await createUserWithContext(client, 'index-isolation-a')
    const { user: userB } = await createUserWithContext(client, 'index-isolation-b')

    const response = await client.get(`/api/prospects/${prospect.id}/positionings`).loginAs(userB)

    response.assertStatus(404)
  })

  test('GET /api/prospects/:id/positionings is accessible for archived prospect', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'index-archived',
    )

    await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })

    // Archive the prospect
    await client.delete(`/api/prospects/${prospect.id}`).loginAs(user)

    // Historical data should still be accessible
    const response = await client.get(`/api/prospects/${prospect.id}/positionings`).loginAs(user)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
  })

  test('GET /api/prospects/:id/positionings returns 401 without authentication', async ({
    client,
  }) => {
    const { prospect } = await createUserWithContext(client, 'index-401')

    const response = await client.get(`/api/prospects/${prospect.id}/positionings`)

    response.assertStatus(401)
  })

  // H1 fix — archived positioning must still appear in history (withTrashed on preload)
  test('GET /api/prospects/:id/positionings includes pp with archived positioning', async ({
    client,
    assert,
  }) => {
    const { user, stage, prospect, positioning } = await createUserWithContext(
      client,
      'index-archived-pos',
    )

    await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })

    // Archive the positioning — pp record stays, positioning becomes soft-deleted
    await client.delete(`/api/positionings/${positioning.id}`).loginAs(user)

    // Must not crash (500) — withTrashed on preload ensures archived positioning is loaded
    const response = await client.get(`/api/prospects/${prospect.id}/positionings`).loginAs(user)

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].positioningId, positioning.id)
    assert.equal(response.body().data[0].positioningName, positioning.name)
  })

  // M1 — positioning_id belonging to another user must return 404 (M1 isolation pattern)
  test('POST /api/prospects/:id/positionings returns 404 for positioning belonging to another user', async ({
    client,
  }) => {
    const { user: userA, prospect: prospectA } = await createUserWithContext(
      client,
      'assign-pos-isolation-a',
    )
    const { positioning: posB } = await createUserWithContext(client, 'assign-pos-isolation-b')

    // userA uses their own prospect but userB's positioning_id → 404
    const response = await client
      .post(`/api/prospects/${prospectA.id}/positionings`)
      .json({ positioning_id: posB.id })
      .loginAs(userA)

    response.assertStatus(404)
  })

  // L1 — setOutcome works on archived prospect (archival flow in Story 5B.3)
  test('PATCH /api/prospects/:id/positionings/current/outcome works on archived prospect', async ({
    client,
    assert,
  }) => {
    const { user, prospect, positioning } = await createUserWithContext(
      client,
      'outcome-archived-pros',
    )

    // Assign positioning
    await client
      .post(`/api/prospects/${prospect.id}/positionings`)
      .json({ positioning_id: positioning.id })
      .loginAs(user)

    // Archive the prospect
    await client.delete(`/api/prospects/${prospect.id}`).loginAs(user)

    // setOutcome must still work (withTrashed on prospect in controller)
    const response = await client
      .patch(`/api/prospects/${prospect.id}/positionings/current/outcome`)
      .json({ outcome: 'success' })
      .loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().outcome, 'success')
  })
})
