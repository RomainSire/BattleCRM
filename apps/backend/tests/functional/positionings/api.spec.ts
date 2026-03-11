import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-positionings-api.com'

test.group('Positionings API', (group) => {
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

  async function createPositioning(
    userId: string,
    stageId: string,
    name = 'Test Positioning',
  ): Promise<Positioning> {
    return Positioning.create({ userId, funnelStageId: stageId, name })
  }

  // ===========================
  // GET /api/positionings
  // ===========================

  test('GET /api/positionings returns active positionings with correct shape', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-list')
    const stage = await getUserFirstStage(user.id)
    await createPositioning(user.id, stage.id, 'My Positioning')

    const response = await client.get('/api/positionings').loginAs(user)
    response.assertStatus(200)

    const body = response.body()
    assert.property(body, 'data')
    assert.property(body, 'meta')
    assert.property(body.meta, 'total')
    assert.isArray(body.data)
    assert.equal(body.data.length, body.meta.total)

    const item = body.data[0]
    assert.property(item, 'id')
    assert.property(item, 'name')
    assert.property(item, 'funnelStageId')
    assert.property(item, 'funnelStageName')
    assert.equal(item.funnelStageName, stage.name)
    assert.equal(item.funnelStageId, stage.id)
  })

  test('GET /api/positionings excludes soft-deleted by default', async ({ client, assert }) => {
    const user = await registerUser(client, 'get-excl-archived')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id)
    await p.delete()

    const response = await client.get('/api/positionings').loginAs(user)
    response.assertStatus(200)

    const ids = response.body().data.map((item: { id: string }) => item.id)
    assert.notInclude(ids, p.id, 'Soft-deleted positioning should not appear in active list')
  })

  test('GET /api/positionings?include_archived=true includes soft-deleted', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-include-archived')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id)
    await p.delete()

    const activeResponse = await client.get('/api/positionings').loginAs(user)
    const archivedResponse = await client
      .get('/api/positionings?include_archived=true')
      .loginAs(user)

    activeResponse.assertStatus(200)
    archivedResponse.assertStatus(200)

    const activeIds = activeResponse.body().data.map((item: { id: string }) => item.id)
    const archivedIds = archivedResponse.body().data.map((item: { id: string }) => item.id)

    assert.notInclude(activeIds, p.id, 'Soft-deleted should not appear in active list')
    assert.include(archivedIds, p.id, 'Soft-deleted should appear with include_archived=true')
  })

  test('GET /api/positionings?funnel_stage_id=:uuid filters by stage', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-filter-stage')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    await createPositioning(user.id, stages[0].id, 'Stage 1 Positioning')
    await createPositioning(user.id, stages[1].id, 'Stage 2 Positioning')

    const response = await client
      .get(`/api/positionings?funnel_stage_id=${stages[0].id}`)
      .loginAs(user)
    response.assertStatus(200)

    const names = response.body().data.map((item: { name: string }) => item.name)
    assert.include(names, 'Stage 1 Positioning')
    assert.notInclude(names, 'Stage 2 Positioning')
  })

  test('GET /api/positionings?funnel_stage_id=invalid returns 422', async ({ client }) => {
    const user = await registerUser(client, 'get-filter-invalid')
    const response = await client.get('/api/positionings?funnel_stage_id=not-a-uuid').loginAs(user)
    response.assertStatus(422)
  })

  test('GET /api/positionings?funnel_stage_id=other-user-stage returns 404', async ({ client }) => {
    const userA = await registerUser(client, 'get-filter-other-a')
    const userB = await registerUser(client, 'get-filter-other-b')
    const stageA = await getUserFirstStage(userA.id)

    const response = await client
      .get(`/api/positionings?funnel_stage_id=${stageA.id}`)
      .loginAs(userB)
    response.assertStatus(404)
  })

  test('GET /api/positionings?include_archived=true&funnel_stage_id=:uuid filters archived by stage', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-combined-filter')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    const p1 = await createPositioning(user.id, stages[0].id, 'Archived Stage 1')
    const p2 = await createPositioning(user.id, stages[1].id, 'Archived Stage 2')
    await p1.delete()
    await p2.delete()

    const response = await client
      .get(`/api/positionings?include_archived=true&funnel_stage_id=${stages[0].id}`)
      .loginAs(user)
    response.assertStatus(200)

    const ids = response.body().data.map((item: { id: string }) => item.id)
    assert.include(ids, p1.id, 'Archived positioning for stage 1 should be returned')
    assert.notInclude(ids, p2.id, 'Archived positioning for stage 2 should not be returned')
  })

  // ===========================
  // GET /api/positionings/:id
  // ===========================

  test('GET /api/positionings/:id returns correct positioning', async ({ client, assert }) => {
    const user = await registerUser(client, 'get-show')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id, 'Show Me')

    const response = await client.get(`/api/positionings/${p.id}`).loginAs(user)
    response.assertStatus(200)

    assert.equal(response.body().id, p.id)
    assert.equal(response.body().name, 'Show Me')
    assert.equal(response.body().funnelStageName, stage.name)
  })

  test('GET /api/positionings/:id returns 404 for non-existent positioning', async ({ client }) => {
    const user = await registerUser(client, 'get-show-404')
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const response = await client.get(`/api/positionings/${fakeId}`).loginAs(user)
    response.assertStatus(404)
  })

  test('GET /api/positionings/not-a-uuid returns 404', async ({ client }) => {
    const user = await registerUser(client, 'get-show-bad-id')
    const response = await client.get('/api/positionings/not-a-uuid').loginAs(user)
    response.assertStatus(404)
  })

  test('GET /api/positionings/:id returns 404 for soft-deleted positioning', async ({ client }) => {
    const user = await registerUser(client, 'get-show-archived')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id)
    await p.delete()

    const response = await client.get(`/api/positionings/${p.id}`).loginAs(user)
    response.assertStatus(404)
  })

  // ===========================
  // POST /api/positionings
  // ===========================

  test('POST /api/positionings creates positioning with required fields → 201', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'post-create')
    const stage = await getUserFirstStage(user.id)

    const response = await client.post('/api/positionings').loginAs(user).json({
      name: 'CV v1',
      funnel_stage_id: stage.id,
    })

    response.assertStatus(201)
    assert.equal(response.body().name, 'CV v1')
    assert.equal(response.body().funnelStageId, stage.id)
    assert.equal(response.body().funnelStageName, stage.name)
    assert.isDefined(response.body().id)
    assert.isNull(response.body().description)
    assert.isNull(response.body().content)
  })

  test('POST /api/positionings creates positioning with all fields → 201', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'post-create-full')
    const stage = await getUserFirstStage(user.id)

    const response = await client.post('/api/positionings').loginAs(user).json({
      name: 'CV v2',
      funnel_stage_id: stage.id,
      description: 'Architecture focused',
      content: 'Full CV content here',
    })

    response.assertStatus(201)
    assert.equal(response.body().description, 'Architecture focused')
    assert.equal(response.body().content, 'Full CV content here')
  })

  test('POST /api/positionings returns 422 when name is missing', async ({ client }) => {
    const user = await registerUser(client, 'post-no-name')
    const stage = await getUserFirstStage(user.id)

    const response = await client.post('/api/positionings').loginAs(user).json({
      funnel_stage_id: stage.id,
    })
    response.assertStatus(422)
  })

  test('POST /api/positionings returns 422 when name is empty string', async ({ client }) => {
    const user = await registerUser(client, 'post-empty-name')
    const stage = await getUserFirstStage(user.id)

    const response = await client.post('/api/positionings').loginAs(user).json({
      name: '   ',
      funnel_stage_id: stage.id,
    })
    response.assertStatus(422)
  })

  test('POST /api/positionings returns 422 when funnel_stage_id is missing', async ({ client }) => {
    const user = await registerUser(client, 'post-no-stage')

    const response = await client.post('/api/positionings').loginAs(user).json({ name: 'Test' })
    response.assertStatus(422)
  })

  test('POST /api/positionings returns 404 for another user funnel_stage_id', async ({
    client,
  }) => {
    const userA = await registerUser(client, 'post-stage-other-a')
    const userB = await registerUser(client, 'post-stage-other-b')
    const stageA = await getUserFirstStage(userA.id)

    const response = await client.post('/api/positionings').loginAs(userB).json({
      name: 'Test',
      funnel_stage_id: stageA.id,
    })
    response.assertStatus(404)
  })

  // ===========================
  // PUT /api/positionings/:id
  // ===========================

  test('PUT /api/positionings/:id updates name → 200', async ({ client, assert }) => {
    const user = await registerUser(client, 'put-update')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id, 'Original Name')

    const response = await client
      .put(`/api/positionings/${p.id}`)
      .loginAs(user)
      .json({ name: 'Updated Name' })

    response.assertStatus(200)
    assert.equal(response.body().name, 'Updated Name')
    assert.equal(response.body().id, p.id)
    assert.equal(response.body().funnelStageName, stage.name)
  })

  test('PUT /api/positionings/:id updates funnel_stage_id → 200', async ({ client, assert }) => {
    const user = await registerUser(client, 'put-update-stage')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')
    const p = await createPositioning(user.id, stages[0].id)

    const response = await client
      .put(`/api/positionings/${p.id}`)
      .loginAs(user)
      .json({ funnel_stage_id: stages[1].id })

    response.assertStatus(200)
    assert.equal(response.body().funnelStageId, stages[1].id)
    assert.equal(response.body().funnelStageName, stages[1].name)
  })

  test('PUT /api/positionings/:id returns 404 for non-existent positioning', async ({ client }) => {
    const user = await registerUser(client, 'put-404')
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const response = await client
      .put(`/api/positionings/${fakeId}`)
      .loginAs(user)
      .json({ name: 'Ghost' })
    response.assertStatus(404)
  })

  test('PUT /api/positionings/:id returns 404 for non-UUID id format', async ({ client }) => {
    const user = await registerUser(client, 'put-bad-id')

    const response = await client
      .put('/api/positionings/not-a-uuid')
      .loginAs(user)
      .json({ name: 'Test' })
    response.assertStatus(404)
  })

  test('PUT /api/positionings/:id updates description and content → 200', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'put-update-desc')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id)

    const response = await client
      .put(`/api/positionings/${p.id}`)
      .loginAs(user)
      .json({ description: 'New description', content: 'New content' })

    response.assertStatus(200)
    assert.equal(response.body().description, 'New description')
    assert.equal(response.body().content, 'New content')
  })

  test('PUT /api/positionings/:id preserves existing fields when omitted (partial update)', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'put-partial')
    const stage = await getUserFirstStage(user.id)

    // Create with description and content set
    const created = await client.post('/api/positionings').loginAs(user).json({
      name: 'Original',
      funnel_stage_id: stage.id,
      description: 'Keep me',
      content: 'Keep me too',
    })
    created.assertStatus(201)
    const id = created.body().id

    // Update only name — description and content should be preserved
    const response = await client
      .put(`/api/positionings/${id}`)
      .loginAs(user)
      .json({ name: 'Updated' })

    response.assertStatus(200)
    assert.equal(response.body().name, 'Updated')
    assert.equal(response.body().description, 'Keep me', 'description should be preserved')
    assert.equal(response.body().content, 'Keep me too', 'content should be preserved')
  })

  test('PUT /api/positionings/:id clears description to null explicitly', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'put-clear-desc')
    const stage = await getUserFirstStage(user.id)

    const created = await client.post('/api/positionings').loginAs(user).json({
      name: 'Test',
      funnel_stage_id: stage.id,
      description: 'Clear me',
    })
    created.assertStatus(201)
    const id = created.body().id

    const response = await client
      .put(`/api/positionings/${id}`)
      .loginAs(user)
      .json({ description: null })

    response.assertStatus(200)
    assert.isNull(response.body().description, 'description should be cleared to null')
  })

  test('PUT /api/positionings/:id returns 404 for another user funnel_stage_id', async ({
    client,
  }) => {
    const userA = await registerUser(client, 'put-stage-other-a')
    const userB = await registerUser(client, 'put-stage-other-b')
    const stageA = await getUserFirstStage(userA.id)
    const stageB = await getUserFirstStage(userB.id)
    const p = await createPositioning(userB.id, stageB.id)

    const response = await client
      .put(`/api/positionings/${p.id}`)
      .loginAs(userB)
      .json({ funnel_stage_id: stageA.id })
    response.assertStatus(404)
  })

  // ===========================
  // DELETE /api/positionings/:id
  // ===========================

  test('DELETE /api/positionings/:id soft-deletes positioning → 200', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'delete-soft')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id)

    const deleteResponse = await client.delete(`/api/positionings/${p.id}`).loginAs(user)
    deleteResponse.assertStatus(200)

    // Not in active list
    const listResponse = await client.get('/api/positionings').loginAs(user)
    const ids = listResponse.body().data.map((item: { id: string }) => item.id)
    assert.notInclude(ids, p.id, 'Soft-deleted positioning should not appear in active list')

    // Appears with include_archived=true
    const archivedResponse = await client
      .get('/api/positionings?include_archived=true')
      .loginAs(user)
    const archivedIds = archivedResponse.body().data.map((item: { id: string }) => item.id)
    assert.include(archivedIds, p.id, 'Soft-deleted should appear with include_archived=true')

    // deleted_at is set in DB
    const softDeleted = await Positioning.query().withTrashed().where('id', p.id).firstOrFail()
    assert.isNotNull(softDeleted.deletedAt, 'deleted_at should be set')
  })

  test('DELETE /api/positionings/:id returns 404 for non-existent positioning', async ({
    client,
  }) => {
    const user = await registerUser(client, 'delete-404')
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const response = await client.delete(`/api/positionings/${fakeId}`).loginAs(user)
    response.assertStatus(404)
  })

  test('DELETE /api/positionings/:id returns 404 for non-UUID id format', async ({ client }) => {
    const user = await registerUser(client, 'delete-bad-id')
    const response = await client.delete('/api/positionings/not-a-uuid').loginAs(user)
    response.assertStatus(404)
  })

  // ===========================
  // GET /api/positionings/:id/prospects
  // ===========================

  test('GET /api/positionings/:id/prospects returns linked prospects', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-prospects')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id)

    // Link a prospect to this positioning via API
    const prospectRes = await client.post('/api/prospects').loginAs(user).json({
      name: 'Jane Doe',
      funnel_stage_id: stage.id,
      positioning_id: p.id,
    })
    prospectRes.assertStatus(201)

    const response = await client.get(`/api/positionings/${p.id}/prospects`).loginAs(user)
    response.assertStatus(200)

    const body = response.body()
    assert.property(body, 'data')
    assert.property(body, 'meta')
    assert.equal(body.data.length, 1)
    assert.equal(body.data[0].name, 'Jane Doe')
    assert.equal(body.data[0].positioningId, p.id)
  })

  test('GET /api/positionings/:id/prospects returns empty list when no prospects linked', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-prospects-empty')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id)

    const response = await client.get(`/api/positionings/${p.id}/prospects`).loginAs(user)
    response.assertStatus(200)
    assert.equal(response.body().data.length, 0)
    assert.equal(response.body().meta.total, 0)
  })

  test('GET /api/positionings/:id/prospects includes archived (soft-deleted) prospects', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-prospects-archived')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id)

    // Create and link a prospect via API, then archive it
    const prospectRes = await client.post('/api/prospects').loginAs(user).json({
      name: 'Archived Prospect',
      funnel_stage_id: stage.id,
      positioning_id: p.id,
    })
    prospectRes.assertStatus(201)
    const prospectId = prospectRes.body().id

    await client.delete(`/api/prospects/${prospectId}`).loginAs(user)

    // Archived prospect should still appear in positioning's prospect list
    const response = await client.get(`/api/positionings/${p.id}/prospects`).loginAs(user)
    response.assertStatus(200)

    const ids = response.body().data.map((item: { id: string }) => item.id)
    assert.include(
      ids,
      prospectId,
      'Archived prospect should still be listed for historical context',
    )
  })

  test('GET /api/positionings/:id/prospects accessible for archived positioning', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-prospects-archived-pos')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id)

    // Link a prospect
    const prospectRes = await client.post('/api/prospects').loginAs(user).json({
      name: 'Prospect On Archived Pos',
      funnel_stage_id: stage.id,
      positioning_id: p.id,
    })
    prospectRes.assertStatus(201)

    // Archive the positioning itself
    await client.delete(`/api/positionings/${p.id}`).loginAs(user)

    // Should still be accessible for historical context (M1 fix)
    const response = await client.get(`/api/positionings/${p.id}/prospects`).loginAs(user)
    response.assertStatus(200)
    assert.equal(response.body().data.length, 1)
    assert.equal(response.body().data[0].name, 'Prospect On Archived Pos')
  })

  test('GET /api/positionings/:id/prospects returns 404 for non-existent positioning', async ({
    client,
  }) => {
    const user = await registerUser(client, 'get-prospects-404')
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const response = await client.get(`/api/positionings/${fakeId}/prospects`).loginAs(user)
    response.assertStatus(404)
  })

  // ===========================
  // PATCH /api/positionings/:id/restore
  // ===========================

  test('PATCH /api/positionings/:id/restore restores a soft-deleted positioning → 200', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'restore-ok')
    const stage = await getUserFirstStage(user.id)
    const p = await createPositioning(user.id, stage.id, 'To Restore')
    await p.delete()

    const response = await client.patch(`/api/positionings/${p.id}/restore`).loginAs(user)
    response.assertStatus(200)

    const body = response.body()
    assert.equal(body.id, p.id)
    assert.equal(body.name, 'To Restore')
    assert.equal(body.funnelStageName, stage.name)
    assert.isNull(body.deletedAt, 'deletedAt should be null after restore')

    // Appears in active list again
    const listResponse = await client.get('/api/positionings').loginAs(user)
    const ids = listResponse.body().data.map((item: { id: string }) => item.id)
    assert.include(ids, p.id, 'Restored positioning should appear in active list')
  })

  test('PATCH /api/positionings/:id/restore returns 404 for non-existent positioning', async ({
    client,
  }) => {
    const user = await registerUser(client, 'restore-404')
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const response = await client.patch(`/api/positionings/${fakeId}/restore`).loginAs(user)
    response.assertStatus(404)
  })

  test('PATCH /api/positionings/:id/restore returns 404 for non-UUID id format', async ({
    client,
  }) => {
    const user = await registerUser(client, 'restore-bad-id')
    const response = await client.patch('/api/positionings/not-a-uuid/restore').loginAs(user)
    response.assertStatus(404)
  })

  test('user isolation: PATCH restore cannot restore another user positioning (404)', async ({
    client,
  }) => {
    const userA = await registerUser(client, 'restore-iso-a')
    const userB = await registerUser(client, 'restore-iso-b')
    const stageA = await getUserFirstStage(userA.id)
    const p = await createPositioning(userA.id, stageA.id)
    await p.delete()

    const response = await client.patch(`/api/positionings/${p.id}/restore`).loginAs(userB)
    response.assertStatus(404)
  })

  // ===========================
  // Authentication (401)
  // ===========================

  test('returns 401 for unauthenticated GET list request', async ({ client }) => {
    const response = await client.get('/api/positionings')
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated POST request', async ({ client }) => {
    const response = await client.post('/api/positionings').json({ name: 'Test' })
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated PUT request', async ({ client }) => {
    const response = await client
      .put('/api/positionings/00000000-0000-0000-0000-000000000000')
      .json({ name: 'Test' })
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated DELETE request', async ({ client }) => {
    const response = await client.delete('/api/positionings/00000000-0000-0000-0000-000000000000')
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated prospects sub-resource request', async ({ client }) => {
    const response = await client.get(
      '/api/positionings/00000000-0000-0000-0000-000000000000/prospects',
    )
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated PATCH restore request', async ({ client }) => {
    const response = await client.patch(
      '/api/positionings/00000000-0000-0000-0000-000000000000/restore',
    )
    response.assertStatus(401)
  })

  // ===========================
  // User Isolation
  // ===========================

  test('user isolation: GET list only returns own positionings', async ({ client, assert }) => {
    const userA = await registerUser(client, 'iso-list-a')
    const userB = await registerUser(client, 'iso-list-b')
    const stageA = await getUserFirstStage(userA.id)
    await createPositioning(userA.id, stageA.id, 'User A Positioning')

    const response = await client.get('/api/positionings').loginAs(userB)
    response.assertStatus(200)
    const names = response.body().data.map((item: { name: string }) => item.name)
    assert.notInclude(names, 'User A Positioning', 'User B should not see User A positionings')
  })

  test('user isolation: GET show returns 404 for another user positioning', async ({ client }) => {
    const userA = await registerUser(client, 'iso-show-a')
    const userB = await registerUser(client, 'iso-show-b')
    const stageA = await getUserFirstStage(userA.id)
    const p = await createPositioning(userA.id, stageA.id)

    const response = await client.get(`/api/positionings/${p.id}`).loginAs(userB)
    response.assertStatus(404)
  })

  test('user isolation: PUT cannot update another user positioning (404)', async ({ client }) => {
    const userA = await registerUser(client, 'iso-put-a')
    const userB = await registerUser(client, 'iso-put-b')
    const stageA = await getUserFirstStage(userA.id)
    const p = await createPositioning(userA.id, stageA.id)

    const response = await client
      .put(`/api/positionings/${p.id}`)
      .loginAs(userB)
      .json({ name: 'Hacked' })
    response.assertStatus(404)
  })

  test('user isolation: DELETE cannot delete another user positioning (404)', async ({
    client,
  }) => {
    const userA = await registerUser(client, 'iso-del-a')
    const userB = await registerUser(client, 'iso-del-b')
    const stageA = await getUserFirstStage(userA.id)
    const p = await createPositioning(userA.id, stageA.id)

    const response = await client.delete(`/api/positionings/${p.id}`).loginAs(userB)
    response.assertStatus(404)
  })

  test('user isolation: GET prospects returns 404 for another user positioning', async ({
    client,
  }) => {
    const userA = await registerUser(client, 'iso-prospects-a')
    const userB = await registerUser(client, 'iso-prospects-b')
    const stageA = await getUserFirstStage(userA.id)
    const p = await createPositioning(userA.id, stageA.id)

    const response = await client.get(`/api/positionings/${p.id}/prospects`).loginAs(userB)
    response.assertStatus(404)
  })
})
