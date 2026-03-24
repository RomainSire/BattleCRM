import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import FunnelStage from '#models/funnel_stage'
import Interaction from '#models/interaction'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-interactions-api.local'

test.group('Interactions API', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    // ON DELETE CASCADE on interactions.user_id removes their interactions automatically
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

  async function createInteraction(
    userId: string,
    prospectId: string,
    overrides: {
      positioningId?: string | null
      status?: 'positive' | 'pending' | 'negative'
      interactionDate?: DateTime
    } = {},
  ) {
    // funnelStageId is a server-side snapshot — auto-captured from prospect (mirrors controller behaviour)
    const prospect = await Prospect.query().withTrashed().where('id', prospectId).firstOrFail()
    return Interaction.create({
      userId,
      prospectId,
      positioningId: overrides.positioningId ?? null,
      funnelStageId: prospect.funnelStageId,
      status: overrides.status ?? 'positive',
      interactionDate: overrides.interactionDate ?? DateTime.now(),
    })
  }

  // ===========================
  // GET /api/interactions — list
  // ===========================

  test('GET /api/interactions returns interactions with correct shape', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'list-shape')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Test Prospect',
    })
    await createInteraction(user.id, prospect.id)

    const response = await client.get('/api/interactions').loginAs(user)
    response.assertStatus(200)
    const { data, meta } = response.body()
    assert.isArray(data)
    assert.isDefined(meta.total)
    assert.equal(data[0].prospectName, 'Test Prospect')
    assert.equal(data[0].prospectFunnelStageName, stage.name)
    assert.equal(data[0].prospectFunnelStageId, stage.id)
    assert.equal(data[0].status, 'positive')
    assert.isNull(data[0].positioningName)
    assert.isNull(data[0].positioningId)
  })

  test('GET /api/interactions ordered by interaction_date desc', async ({ client, assert }) => {
    const user = await registerUser(client, 'list-order')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
    const i1 = await createInteraction(user.id, prospect.id, {
      interactionDate: DateTime.now().minus({ days: 1 }),
    })
    const i2 = await createInteraction(user.id, prospect.id, { interactionDate: DateTime.now() })

    const response = await client.get('/api/interactions').loginAs(user)
    response.assertStatus(200)
    assert.equal(response.body().data[0].id, i2.id)
    assert.equal(response.body().data[1].id, i1.id)
  })

  test('GET /api/interactions excludes soft-deleted by default', async ({ client, assert }) => {
    const user = await registerUser(client, 'list-excl-deleted')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
    const i1 = await createInteraction(user.id, prospect.id)
    const i2 = await createInteraction(user.id, prospect.id, { status: 'negative' })
    await i2.delete()

    const response = await client.get('/api/interactions').loginAs(user)
    response.assertStatus(200)
    const ids = response.body().data.map((i: { id: string }) => i.id)
    assert.include(ids, i1.id)
    assert.notInclude(ids, i2.id)
  })

  test('GET /api/interactions?include_archived=true includes soft-deleted', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'list-incl-archived')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
    await createInteraction(user.id, prospect.id)
    const i2 = await createInteraction(user.id, prospect.id, { status: 'negative' })
    await i2.delete()

    const response = await client.get('/api/interactions?include_archived=true').loginAs(user)
    response.assertStatus(200)
    const ids = response.body().data.map((i: { id: string }) => i.id)
    assert.include(ids, i2.id)
  })

  // ===========================
  // GET filters
  // ===========================

  test('GET /api/interactions?prospect_id filters by prospect', async ({ client, assert }) => {
    const user = await registerUser(client, 'filter-prospect')
    const stage = await getUserFirstStage(user.id)
    const p1 = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P1' })
    const p2 = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P2' })
    const i1 = await createInteraction(user.id, p1.id)
    await createInteraction(user.id, p2.id)

    const response = await client.get(`/api/interactions?prospect_id=${p1.id}`).loginAs(user)
    response.assertStatus(200)
    const ids = response.body().data.map((i: { id: string }) => i.id)
    assert.include(ids, i1.id)
    assert.lengthOf(ids, 1)
  })

  test('GET /api/interactions?prospect_id=invalid returns 422', async ({ client }) => {
    const user = await registerUser(client, 'filter-prospect-invalid')
    const response = await client.get('/api/interactions?prospect_id=not-a-uuid').loginAs(user)
    response.assertStatus(422)
  })

  test('GET /api/interactions?prospect_id (another user) returns 404', async ({ client }) => {
    const userA = await registerUser(client, 'filter-prospect-iso-a')
    const userB = await registerUser(client, 'filter-prospect-iso-b')
    const stageA = await getUserFirstStage(userA.id)
    const prospectA = await Prospect.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'PA',
    })

    const response = await client
      .get(`/api/interactions?prospect_id=${prospectA.id}`)
      .loginAs(userB)
    response.assertStatus(404)
  })

  test('GET /api/interactions?positioning_id filters by positioning', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'filter-positioning')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'P',
    })
    const positioning = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'LinkedIn v1',
    })
    const i1 = await createInteraction(user.id, prospect.id, { positioningId: positioning.id })
    await createInteraction(user.id, prospect.id) // no positioning

    const response = await client
      .get(`/api/interactions?positioning_id=${positioning.id}`)
      .loginAs(user)
    response.assertStatus(200)
    const ids = response.body().data.map((i: { id: string }) => i.id)
    assert.include(ids, i1.id)
    assert.lengthOf(ids, 1)
  })

  test('GET /api/interactions?positioning_id=invalid returns 422', async ({ client }) => {
    const user = await registerUser(client, 'filter-positioning-invalid')
    const response = await client.get('/api/interactions?positioning_id=not-a-uuid').loginAs(user)
    response.assertStatus(422)
  })

  test('GET /api/interactions?positioning_id (another user) returns 404', async ({ client }) => {
    const userA = await registerUser(client, 'filter-positioning-iso-a')
    const userB = await registerUser(client, 'filter-positioning-iso-b')
    const stageA = await getUserFirstStage(userA.id)
    const positioningA = await Positioning.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'PA Positioning',
    })

    const response = await client
      .get(`/api/interactions?positioning_id=${positioningA.id}`)
      .loginAs(userB)
    response.assertStatus(404)
  })

  test('GET /api/interactions?status=positive filters by status', async ({ client, assert }) => {
    const user = await registerUser(client, 'filter-status')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'P',
    })
    const i1 = await createInteraction(user.id, prospect.id, { status: 'positive' })
    await createInteraction(user.id, prospect.id, { status: 'negative' })

    const response = await client.get('/api/interactions?status=positive').loginAs(user)
    response.assertStatus(200)
    const ids = response.body().data.map((i: { id: string }) => i.id)
    assert.include(ids, i1.id)
    assert.lengthOf(ids, 1)
  })

  test('GET /api/interactions?status=invalid returns 422', async ({ client }) => {
    const user = await registerUser(client, 'filter-status-invalid')
    const response = await client.get('/api/interactions?status=unknown').loginAs(user)
    response.assertStatus(422)
  })

  test('GET /api/interactions?funnel_stage_id filters by interaction funnel_stage_id snapshot', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'filter-stage')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')
    const p1 = await Prospect.create({ userId: user.id, funnelStageId: stages[0].id, name: 'P1' })
    const p2 = await Prospect.create({ userId: user.id, funnelStageId: stages[1].id, name: 'P2' })
    const i1 = await createInteraction(user.id, p1.id)
    await createInteraction(user.id, p2.id)

    const response = await client
      .get(`/api/interactions?funnel_stage_id=${stages[0].id}`)
      .loginAs(user)
    response.assertStatus(200)
    const ids = response.body().data.map((i: { id: string }) => i.id)
    assert.include(ids, i1.id)
    assert.lengthOf(ids, 1)
  })

  test('GET /api/interactions?funnel_stage_id includes interactions for archived prospects', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'filter-stage-archived')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'ArchivedP',
    })
    const interaction = await createInteraction(user.id, prospect.id)
    await prospect.delete() // archive the prospect

    const response = await client.get(`/api/interactions?funnel_stage_id=${stage.id}`).loginAs(user)
    response.assertStatus(200)
    const ids = response.body().data.map((i: { id: string }) => i.id)
    assert.include(ids, interaction.id)
  })

  test('GET /api/interactions?funnel_stage_id=invalid returns 422', async ({ client }) => {
    const user = await registerUser(client, 'filter-stage-invalid')
    const response = await client.get('/api/interactions?funnel_stage_id=not-a-uuid').loginAs(user)
    response.assertStatus(422)
  })

  test('GET /api/interactions?funnel_stage_id (another user) returns 404', async ({ client }) => {
    const userA = await registerUser(client, 'filter-stage-iso-a')
    const userB = await registerUser(client, 'filter-stage-iso-b')
    const stageA = await getUserFirstStage(userA.id)

    const response = await client
      .get(`/api/interactions?funnel_stage_id=${stageA.id}`)
      .loginAs(userB)
    response.assertStatus(404)
  })

  // ===========================
  // GET /api/interactions/:id
  // ===========================

  test('GET /api/interactions/:id returns correct interaction', async ({ client, assert }) => {
    const user = await registerUser(client, 'get-single')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
    const interaction = await createInteraction(user.id, prospect.id)

    const response = await client.get(`/api/interactions/${interaction.id}`).loginAs(user)
    response.assertStatus(200)
    assert.equal(response.body().id, interaction.id)
    assert.equal(response.body().prospectName, 'P')
  })

  test('GET /api/interactions/:id non-existent returns 404', async ({ client }) => {
    const user = await registerUser(client, 'get-single-404')
    const response = await client
      .get('/api/interactions/00000000-0000-0000-0000-000000000000')
      .loginAs(user)
    response.assertStatus(404)
  })

  // ===========================
  // POST /api/interactions
  // ===========================

  test('POST /api/interactions creates interaction with all fields → 201', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'post-full')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
    const positioning = await Positioning.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'LinkedIn v1',
    })

    const response = await client.post('/api/interactions').loginAs(user).json({
      prospect_id: prospect.id,
      positioning_id: positioning.id,
      status: 'positive',
      notes: 'Great talk',
      interaction_date: DateTime.now().toISO(),
    })
    response.assertStatus(201)
    assert.isDefined(response.body().id)
    assert.equal(response.body().prospectName, 'P')
    assert.equal(response.body().positioningName, 'LinkedIn v1')
    assert.equal(response.body().status, 'positive')
    assert.equal(response.body().notes, 'Great talk')
  })

  test('POST /api/interactions minimal (no positioning, no notes) → 201 with nulls', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'post-minimal')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })

    const response = await client
      .post('/api/interactions')
      .loginAs(user)
      .json({ prospect_id: prospect.id, status: 'pending' })
    response.assertStatus(201)
    assert.isNull(response.body().positioningId)
    assert.isNull(response.body().positioningName)
    assert.isNull(response.body().notes)
  })

  test('POST /api/interactions without interaction_date defaults to now', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'post-default-date')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })

    const response = await client
      .post('/api/interactions')
      .loginAs(user)
      .json({ prospect_id: prospect.id, status: 'pending' })
    response.assertStatus(201)
    assert.isDefined(response.body().interactionDate)
    assert.isNotNull(response.body().interactionDate)
  })

  test('POST /api/interactions missing status returns 422', async ({ client }) => {
    const user = await registerUser(client, 'post-missing-status')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })

    const response = await client
      .post('/api/interactions')
      .loginAs(user)
      .json({ prospect_id: prospect.id })
    response.assertStatus(422)
  })

  test('POST /api/interactions with another user prospect returns 404', async ({ client }) => {
    const userA = await registerUser(client, 'post-iso-a')
    const userB = await registerUser(client, 'post-iso-b')
    const stageA = await getUserFirstStage(userA.id)
    const prospectA = await Prospect.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'PA',
    })

    const response = await client
      .post('/api/interactions')
      .loginAs(userB)
      .json({ prospect_id: prospectA.id, status: 'positive' })
    response.assertStatus(404)
  })

  // ===========================
  // PUT /api/interactions/:id
  // ===========================

  test('PUT /api/interactions/:id updates status → 200', async ({ client, assert }) => {
    const user = await registerUser(client, 'put-status')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
    const interaction = await createInteraction(user.id, prospect.id, { status: 'pending' })

    const response = await client
      .put(`/api/interactions/${interaction.id}`)
      .loginAs(user)
      .json({ status: 'positive' })
    response.assertStatus(200)
    assert.equal(response.body().status, 'positive')
  })

  test('PUT /api/interactions/:id updates notes to null', async ({ client, assert }) => {
    const user = await registerUser(client, 'put-null-notes')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
    const interaction = await Interaction.create({
      userId: user.id,
      prospectId: prospect.id,
      funnelStageId: stage.id,
      status: 'positive',
      notes: 'some notes',
      interactionDate: DateTime.now(),
    })

    const response = await client
      .put(`/api/interactions/${interaction.id}`)
      .loginAs(user)
      .json({ notes: null })
    response.assertStatus(200)
    assert.isNull(response.body().notes)
  })

  test('PUT /api/interactions/:id with another user positioning_id returns 404', async ({
    client,
  }) => {
    const userA = await registerUser(client, 'put-pos-iso-a')
    const userB = await registerUser(client, 'put-pos-iso-b')
    const stageA = await getUserFirstStage(userA.id)
    const stageB = await getUserFirstStage(userB.id)
    const positioningA = await Positioning.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'Positioning A',
    })
    const prospectB = await Prospect.create({
      userId: userB.id,
      funnelStageId: stageB.id,
      name: 'PB',
    })
    const interaction = await createInteraction(userB.id, prospectB.id)

    const response = await client
      .put(`/api/interactions/${interaction.id}`)
      .loginAs(userB)
      .json({ positioning_id: positioningA.id })
    response.assertStatus(404)
  })

  test('PUT /api/interactions/:id non-existent returns 404', async ({ client }) => {
    const user = await registerUser(client, 'put-404')
    const response = await client
      .put('/api/interactions/00000000-0000-0000-0000-000000000000')
      .loginAs(user)
      .json({ status: 'positive' })
    response.assertStatus(404)
  })

  // ===========================
  // DELETE /api/interactions/:id
  // ===========================

  test('DELETE /api/interactions/:id soft-deletes → 200 and excluded from list', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'delete-soft')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
    const interaction = await createInteraction(user.id, prospect.id)

    const deleteResponse = await client.delete(`/api/interactions/${interaction.id}`).loginAs(user)
    deleteResponse.assertStatus(200)
    assert.equal(deleteResponse.body().message, 'Interaction archived')

    const listResponse = await client.get('/api/interactions').loginAs(user)
    const ids = listResponse.body().data.map((i: { id: string }) => i.id)
    assert.notInclude(ids, interaction.id)
  })

  test('DELETE /api/interactions/:id non-existent returns 404', async ({ client }) => {
    const user = await registerUser(client, 'delete-404')
    const response = await client
      .delete('/api/interactions/00000000-0000-0000-0000-000000000000')
      .loginAs(user)
    response.assertStatus(404)
  })

  // ===========================
  // Auth — unauthenticated → 401
  // ===========================

  test('GET /api/interactions without auth returns 401', async ({ client }) => {
    const response = await client.get('/api/interactions')
    response.assertStatus(401)
  })

  test('POST /api/interactions without auth returns 401', async ({ client }) => {
    const response = await client
      .post('/api/interactions')
      .json({ prospect_id: '00000000-0000-0000-0000-000000000001', status: 'positive' })
    response.assertStatus(401)
  })

  // ===========================
  // Isolation — cross-user → 404
  // ===========================

  test('user isolation: GET /:id returns 404 for another user interaction', async ({ client }) => {
    const userA = await registerUser(client, 'iso-get-a')
    const userB = await registerUser(client, 'iso-get-b')
    const stageA = await getUserFirstStage(userA.id)
    const prospectA = await Prospect.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'PA',
    })
    const interaction = await createInteraction(userA.id, prospectA.id)

    const response = await client.get(`/api/interactions/${interaction.id}`).loginAs(userB)
    response.assertStatus(404)
  })

  test('user isolation: PUT /:id returns 404 for another user interaction', async ({ client }) => {
    const userA = await registerUser(client, 'iso-put-a')
    const userB = await registerUser(client, 'iso-put-b')
    const stageA = await getUserFirstStage(userA.id)
    const prospectA = await Prospect.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'PA',
    })
    const interaction = await createInteraction(userA.id, prospectA.id)

    const response = await client
      .put(`/api/interactions/${interaction.id}`)
      .loginAs(userB)
      .json({ status: 'negative' })
    response.assertStatus(404)
  })

  test('user isolation: DELETE /:id returns 404 for another user interaction', async ({
    client,
  }) => {
    const userA = await registerUser(client, 'iso-del-a')
    const userB = await registerUser(client, 'iso-del-b')
    const stageA = await getUserFirstStage(userA.id)
    const prospectA = await Prospect.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'PA',
    })
    const interaction = await createInteraction(userA.id, prospectA.id)

    const response = await client.delete(`/api/interactions/${interaction.id}`).loginAs(userB)
    response.assertStatus(404)
  })

  // ===========================
  // PATCH /api/interactions/:id/restore
  // ===========================

  test('PATCH /api/interactions/:id/restore restores archived interaction → 200', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'restore-ok')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
    const interaction = await createInteraction(user.id, prospect.id)
    await interaction.delete()

    const response = await client.patch(`/api/interactions/${interaction.id}/restore`).loginAs(user)
    response.assertStatus(200)
    assert.isNull(response.body().deletedAt)
    assert.equal(response.body().id, interaction.id)
    assert.equal(response.body().prospectName, 'P')
  })

  test('PATCH /api/interactions/:id/restore restored interaction appears in default list', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'restore-list')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
    const interaction = await createInteraction(user.id, prospect.id)
    await interaction.delete()

    await client.patch(`/api/interactions/${interaction.id}/restore`).loginAs(user)

    const listResponse = await client.get('/api/interactions').loginAs(user)
    const ids = listResponse.body().data.map((i: { id: string }) => i.id)
    assert.include(ids, interaction.id)
  })

  test('PATCH /api/interactions/:id/restore on non-archived interaction → 404', async ({
    client,
  }) => {
    const user = await registerUser(client, 'restore-not-archived')
    const stage = await getUserFirstStage(user.id)
    const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
    const interaction = await createInteraction(user.id, prospect.id)

    const response = await client.patch(`/api/interactions/${interaction.id}/restore`).loginAs(user)
    response.assertStatus(404)
  })

  test('PATCH /api/interactions/:id/restore non-existent → 404', async ({ client }) => {
    const user = await registerUser(client, 'restore-404')
    const response = await client
      .patch('/api/interactions/00000000-0000-0000-0000-000000000000/restore')
      .loginAs(user)
    response.assertStatus(404)
  })

  test('PATCH /api/interactions/:id/restore without auth → 401', async ({ client }) => {
    const response = await client.patch(
      '/api/interactions/00000000-0000-0000-0000-000000000000/restore',
    )
    response.assertStatus(401)
  })

  test('user isolation: PATCH /:id/restore returns 404 for another user interaction', async ({
    client,
  }) => {
    const userA = await registerUser(client, 'restore-iso-a')
    const userB = await registerUser(client, 'restore-iso-b')
    const stageA = await getUserFirstStage(userA.id)
    const prospectA = await Prospect.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'PA',
    })
    const interaction = await createInteraction(userA.id, prospectA.id)
    await interaction.delete()

    const response = await client
      .patch(`/api/interactions/${interaction.id}/restore`)
      .loginAs(userB)
    response.assertStatus(404)
  })
})
