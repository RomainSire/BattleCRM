import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import User from '#models/user'

type StageDto = { id: string; position: number }

const TEST_EMAIL_DOMAIN = '@test-funnel-api.com'

test.group('FunnelStages API', (group) => {
  // Clean up before the group runs to handle leftover data from previously failed runs
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    // .delete() on query builder executes a raw DELETE (hard-delete, bypasses SoftDeletes mixin)
    // ON DELETE CASCADE on funnel_stages.user_id removes their stages automatically
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  // Helper to register a user and return the model instance for loginAs
  async function registerUser(client: ApiClient, prefix: string): Promise<User> {
    const res = await client.post('/api/auth/register').json({
      email: `${prefix}${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    res.assertStatus(201)
    const userId = res.body().user.id
    return User.findOrFail(userId)
  }

  // ===========================
  // GET /api/funnel_stages
  // ===========================

  test('GET /api/funnel_stages returns active stages ordered by position', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-list')
    const response = await client.get('/api/funnel_stages').loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.property(body, 'data')
    assert.property(body, 'meta')
    assert.property(body.meta, 'total')
    // Default funnel stages were seeded in registration (Story 2.1)
    assert.isAbove(body.data.length, 0)
    assert.equal(body.meta.total, body.data.length)
    // Verify stages are ordered by position ASC
    const positions = body.data.map((s: StageDto) => s.position)
    assert.deepEqual(
      positions,
      [...positions].sort((a, b) => a - b),
    )
  })

  test('GET /api/funnel_stages excludes soft-deleted stages by default', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-excl-archived')

    // Soft-delete one stage directly via model
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')
      .firstOrFail()
    await stage.delete() // SoftDeletes: sets deleted_at

    const response = await client.get('/api/funnel_stages').loginAs(user)
    response.assertStatus(200)

    const ids = response.body().data.map((s: StageDto) => s.id)
    assert.notInclude(ids, stage.id, 'Soft-deleted stage should not appear in active list')
  })

  test('GET /api/funnel_stages?include_archived=true includes soft-deleted stages', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-archived')

    // Soft-delete one stage
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')
      .firstOrFail()
    await stage.delete()

    const activeResponse = await client.get('/api/funnel_stages').loginAs(user)
    const archivedResponse = await client
      .get('/api/funnel_stages?include_archived=true')
      .loginAs(user)

    activeResponse.assertStatus(200)
    archivedResponse.assertStatus(200)

    // Archived response should have more stages
    assert.isAbove(
      archivedResponse.body().data.length,
      activeResponse.body().data.length,
      'include_archived=true should return more stages',
    )

    // The soft-deleted stage should be present in archived response
    const archivedIds = archivedResponse.body().data.map((s: StageDto) => s.id)
    assert.include(archivedIds, stage.id, 'Archived stage should appear with include_archived=true')
  })

  // ===========================
  // POST /api/funnel_stages
  // ===========================

  test('POST /api/funnel_stages creates stage at correct position', async ({ client, assert }) => {
    const user = await registerUser(client, 'post-create')

    const activeStages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'desc')
    const expectedPosition = activeStages[0].position + 1

    const response = await client
      .post('/api/funnel_stages')
      .loginAs(user)
      .json({ name: 'New Test Stage' })

    response.assertStatus(201)
    assert.equal(response.body().name, 'New Test Stage')
    assert.equal(response.body().position, expectedPosition)
    assert.property(response.body(), 'id')
  })

  test('POST /api/funnel_stages returns 422 when name is missing', async ({ client }) => {
    const user = await registerUser(client, 'post-no-name')
    const response = await client.post('/api/funnel_stages').loginAs(user).json({})

    response.assertStatus(422)
  })

  test('POST /api/funnel_stages returns 422 when name is empty string', async ({ client }) => {
    const user = await registerUser(client, 'post-empty-name')
    const response = await client.post('/api/funnel_stages').loginAs(user).json({ name: '   ' }) // whitespace only — VineJS trim + minLength(1) should reject

    response.assertStatus(422)
  })

  test('POST /api/funnel_stages returns 422 when user already has 15 active stages', async ({
    client,
  }) => {
    const user = await registerUser(client, 'post-max-stages')

    // User starts with 10 default stages (seeded on registration in Story 2.1).
    // Add 5 more to reach the 15-stage limit.
    for (let i = 1; i <= 5; i++) {
      const res = await client
        .post('/api/funnel_stages')
        .loginAs(user)
        .json({ name: `Extra Stage ${i}` })
      res.assertStatus(201)
    }

    // Attempt to add a 16th stage — must be rejected with 422 (FR40: max 15)
    const response = await client
      .post('/api/funnel_stages')
      .loginAs(user)
      .json({ name: 'Over The Limit Stage' })

    response.assertStatus(422)
  })

  // ===========================
  // PUT /api/funnel_stages/:id
  // ===========================

  test('PUT /api/funnel_stages/:id updates stage name', async ({ client, assert }) => {
    const user = await registerUser(client, 'put-update')
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .firstOrFail()

    const response = await client
      .put(`/api/funnel_stages/${stage.id}`)
      .loginAs(user)
      .json({ name: 'Updated Stage Name' })

    response.assertStatus(200)
    assert.equal(response.body().name, 'Updated Stage Name')
    assert.equal(response.body().id, stage.id)
  })

  test('PUT /api/funnel_stages/:id returns 404 for non-existent stage', async ({ client }) => {
    const user = await registerUser(client, 'put-404')
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const response = await client
      .put(`/api/funnel_stages/${fakeId}`)
      .loginAs(user)
      .json({ name: 'Ghost Stage' })

    response.assertStatus(404)
  })

  test('PUT /api/funnel_stages/:id returns 404 for non-UUID id format', async ({ client }) => {
    const user = await registerUser(client, 'put-invalid-format')
    const response = await client
      .put('/api/funnel_stages/not-a-uuid')
      .loginAs(user)
      .json({ name: 'Test' })

    response.assertStatus(404)
  })

  // ===========================
  // DELETE /api/funnel_stages/:id
  // ===========================

  test('DELETE /api/funnel_stages/:id soft-deletes the stage', async ({ client, assert }) => {
    const user = await registerUser(client, 'delete-soft')
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .firstOrFail()

    const deleteResponse = await client.delete(`/api/funnel_stages/${stage.id}`).loginAs(user)
    deleteResponse.assertStatus(200)

    // Stage should not appear in active list
    const listResponse = await client.get('/api/funnel_stages').loginAs(user)
    const ids = listResponse.body().data.map((s: StageDto) => s.id)
    assert.notInclude(ids, stage.id, 'Soft-deleted stage should not appear in active list')

    // But should appear with include_archived=true
    const archivedResponse = await client
      .get('/api/funnel_stages?include_archived=true')
      .loginAs(user)
    const archivedIds = archivedResponse.body().data.map((s: StageDto) => s.id)
    assert.include(
      archivedIds,
      stage.id,
      'Soft-deleted stage should appear with include_archived=true',
    )

    // Verify deleted_at is set in database
    const softDeletedStage = await FunnelStage.query().where('id', stage.id).withTrashed().first()
    assert.isNotNull(softDeletedStage?.deletedAt, 'deleted_at should be set')
  })

  test('DELETE /api/funnel_stages/:id renumbers remaining positions sequentially', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'delete-renumber')

    // Get all active stages ordered by position
    const stagesBefore = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    // Delete a middle stage (not first, not last) to verify both sides are renumbered
    const middleIndex = Math.floor(stagesBefore.length / 2)
    const stageToDelete = stagesBefore[middleIndex]

    const deleteResponse = await client
      .delete(`/api/funnel_stages/${stageToDelete.id}`)
      .loginAs(user)
    deleteResponse.assertStatus(200)

    // Fetch remaining active stages
    const listResponse = await client.get('/api/funnel_stages').loginAs(user)
    listResponse.assertStatus(200)
    const stagesAfter: { id: string; position: number }[] = listResponse.body().data

    // Should have one fewer stage
    assert.equal(stagesAfter.length, stagesBefore.length - 1)

    // Positions must be sequential: 1, 2, 3, ...
    const positions = stagesAfter.map((s) => s.position)
    const expectedPositions = stagesAfter.map((_, i) => i + 1)
    assert.deepEqual(
      positions,
      expectedPositions,
      'Positions should be sequential from 1 after delete',
    )
  })

  test('DELETE /api/funnel_stages/:id returns 404 for non-existent stage', async ({ client }) => {
    const user = await registerUser(client, 'delete-404')
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const response = await client.delete(`/api/funnel_stages/${fakeId}`).loginAs(user)
    response.assertStatus(404)
  })

  test('DELETE /api/funnel_stages/:id returns 404 for non-UUID id format', async ({ client }) => {
    const user = await registerUser(client, 'delete-invalid-format')
    const response = await client.delete('/api/funnel_stages/not-a-uuid').loginAs(user)
    response.assertStatus(404)
  })

  // ===========================
  // PUT /api/funnel_stages/reorder
  // ===========================

  test('PUT /api/funnel_stages/reorder correctly reassigns positions', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'put-reorder')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    // Reverse the order of stage IDs
    const reversedIds = [...stages].reverse().map((s) => s.id)

    const response = await client
      .put('/api/funnel_stages/reorder')
      .loginAs(user)
      .json({ order: reversedIds })

    response.assertStatus(200)
    assert.property(response.body(), 'data')
    assert.property(response.body(), 'meta')

    // Verify positions match the provided order
    const returnedIds = response.body().data.map((s: StageDto) => s.id)
    assert.deepEqual(returnedIds, reversedIds, 'Returned order should match requested order')

    // Verify positions are sequential starting from 1
    const returnedPositions = response.body().data.map((s: StageDto) => s.position)
    const expectedPositions = reversedIds.map((_: string, i: number) => i + 1)
    assert.deepEqual(returnedPositions, expectedPositions, 'Positions should be sequential from 1')
  })

  test('PUT /api/funnel_stages/reorder returns 400 for invalid stage IDs', async ({ client }) => {
    const user = await registerUser(client, 'put-reorder-invalid')
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const response = await client
      .put('/api/funnel_stages/reorder')
      .loginAs(user)
      .json({ order: [fakeId] })

    response.assertStatus(400)
  })

  test('PUT /api/funnel_stages/reorder returns 400 for incomplete (partial) stage ID list', async ({
    client,
  }) => {
    const user = await registerUser(client, 'put-reorder-partial')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    // Omit the last stage — valid IDs but not the complete list
    const partialIds = stages.slice(0, stages.length - 1).map((s) => s.id)

    const response = await client
      .put('/api/funnel_stages/reorder')
      .loginAs(user)
      .json({ order: partialIds })

    response.assertStatus(400)
  })

  test('PUT /api/funnel_stages/reorder returns 422 when order is empty', async ({ client }) => {
    const user = await registerUser(client, 'put-reorder-empty')

    const response = await client
      .put('/api/funnel_stages/reorder')
      .loginAs(user)
      .json({ order: [] })

    response.assertStatus(422)
  })

  // ===========================
  // Authentication (AC7)
  // ===========================

  test('returns 401 for unauthenticated GET request', async ({ client }) => {
    const response = await client.get('/api/funnel_stages')
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated POST request', async ({ client }) => {
    const response = await client.post('/api/funnel_stages').json({ name: 'Test' })
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated PUT request', async ({ client }) => {
    const response = await client
      .put('/api/funnel_stages/00000000-0000-0000-0000-000000000000')
      .json({ name: 'Test' })
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated DELETE request', async ({ client }) => {
    const response = await client.delete('/api/funnel_stages/00000000-0000-0000-0000-000000000000')
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated reorder request', async ({ client }) => {
    const response = await client
      .put('/api/funnel_stages/reorder')
      .json({ order: ['00000000-0000-0000-0000-000000000000'] })
    response.assertStatus(401)
  })

  // ===========================
  // User Isolation (AC8)
  // ===========================

  test('user isolation: GET only returns own stages', async ({ client, assert }) => {
    const userA = await registerUser(client, 'iso-get-a')
    const userB = await registerUser(client, 'iso-get-b')

    // Get user A's stage IDs
    const stagesA = await FunnelStage.query().withScopes((s) => s.forUser(userA.id))
    const stageAIds = stagesA.map((s) => s.id)

    // User B's list should NOT contain user A's stages
    const listRes = await client.get('/api/funnel_stages').loginAs(userB)
    listRes.assertStatus(200)
    const returnedIds = listRes.body().data.map((s: StageDto) => s.id)

    for (const id of stageAIds) {
      assert.notInclude(returnedIds, id, `User B should not see user A's stage ${id}`)
    }
  })

  test('user isolation: PUT cannot update another user stage (404)', async ({ client }) => {
    const userA = await registerUser(client, 'iso-put-a')
    const userB = await registerUser(client, 'iso-put-b')

    // Get a stage ID from user A
    const stageA = await FunnelStage.query()
      .withScopes((s) => s.forUser(userA.id))
      .firstOrFail()

    // User B tries to update user A's stage
    const response = await client
      .put(`/api/funnel_stages/${stageA.id}`)
      .loginAs(userB)
      .json({ name: 'Hacked' })

    // forUser scope + firstOrFail → 404 (not 403), preventing data leak
    response.assertStatus(404)
  })

  test('user isolation: DELETE cannot delete another user stage (404)', async ({ client }) => {
    const userA = await registerUser(client, 'iso-del-a')
    const userB = await registerUser(client, 'iso-del-b')

    const stageA = await FunnelStage.query()
      .withScopes((s) => s.forUser(userA.id))
      .firstOrFail()

    const response = await client.delete(`/api/funnel_stages/${stageA.id}`).loginAs(userB)
    response.assertStatus(404)
  })

  test('user isolation: reorder cannot include another user stage IDs (400)', async ({
    client,
  }) => {
    const userA = await registerUser(client, 'iso-reorder-a')
    const userB = await registerUser(client, 'iso-reorder-b')

    // Get stage IDs from user A
    const stagesA = await FunnelStage.query().withScopes((s) => s.forUser(userA.id))
    const stageAIds = stagesA.map((s) => s.id)

    // User B tries to reorder using user A's stage IDs
    const response = await client
      .put('/api/funnel_stages/reorder')
      .loginAs(userB)
      .json({ order: stageAIds })

    // stages.length !== order.length (user B's stages don't include A's IDs)
    response.assertStatus(400)
  })
})
