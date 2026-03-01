import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import FunnelStage from '#models/funnel_stage'
import Prospect from '#models/prospect'
import ProspectStageTransition from '#models/prospect_stage_transition'
import User from '#models/user'

type ProspectDto = {
  id: string
  name: string
  funnelStageId: string
  deletedAt: string | null
}

const TEST_EMAIL_DOMAIN = '@test-prospects-api.com'

test.group('Prospects API', (group) => {
  // Clean up before group to handle leftover data from previously failed runs
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    // ON DELETE CASCADE on prospects.user_id removes their prospects automatically
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function registerUser(client: ApiClient, prefix: string): Promise<User> {
    const res = await client.post('/api/auth/register').json({
      email: `${prefix}${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    res.assertStatus(201)
    const userId = res.body().user.id
    return User.findOrFail(userId)
  }

  async function getFirstStage(userId: string): Promise<FunnelStage> {
    return FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')
      .firstOrFail()
  }

  // ===========================
  // GET /api/prospects
  // ===========================

  test('GET /api/prospects returns empty list when no prospects exist', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-empty')
    const response = await client.get('/api/prospects').loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.property(body, 'data')
    assert.property(body, 'meta')
    assert.equal(body.data.length, 0)
    assert.equal(body.meta.total, 0)
  })

  test('GET /api/prospects returns active prospects ordered by updated_at desc', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-list')
    const stage = await getFirstStage(user.id)

    // Create Alice first, then Bob
    const alice = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'Alice' })
    await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'Bob' })
    // Touch Alice after Bob so she gets the most recent updated_at
    await alice.merge({ company: 'Updated' }).save()

    const response = await client.get('/api/prospects').loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.length, 2)
    assert.equal(body.meta.total, 2)
    // Alice was updated last, so she must appear first (updated_at DESC ordering)
    assert.equal(body.data[0].name, 'Alice', 'Most recently updated prospect should come first')
    assert.equal(body.data[1].name, 'Bob')
  })

  test('GET /api/prospects excludes soft-deleted prospects by default', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-excl-archived')
    const stage = await getFirstStage(user.id)

    const active = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Active',
    })
    const archived = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Archived',
    })
    await archived.delete() // SoftDeletes: sets deleted_at

    const response = await client.get('/api/prospects').loginAs(user)
    response.assertStatus(200)

    const ids = response.body().data.map((p: ProspectDto) => p.id)
    assert.include(ids, active.id)
    assert.notInclude(ids, archived.id, 'Soft-deleted prospect should not appear in active list')
  })

  test('GET /api/prospects?include_archived=true includes soft-deleted prospects', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'get-archived')
    const stage = await getFirstStage(user.id)

    await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'Active' })
    const archived = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Archived',
    })
    await archived.delete()

    const activeResponse = await client.get('/api/prospects').loginAs(user)
    const archivedResponse = await client.get('/api/prospects?include_archived=true').loginAs(user)

    activeResponse.assertStatus(200)
    archivedResponse.assertStatus(200)

    assert.isAbove(
      archivedResponse.body().data.length,
      activeResponse.body().data.length,
      'include_archived=true should return more prospects',
    )

    const archivedIds = archivedResponse.body().data.map((p: ProspectDto) => p.id)
    assert.include(
      archivedIds,
      archived.id,
      'Archived prospect should appear with include_archived=true',
    )
  })

  test('GET /api/prospects?funnel_stage_id filters by stage', async ({ client, assert }) => {
    const user = await registerUser(client, 'get-filter-stage')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    const stage1 = stages[0]
    const stage2 = stages[1]

    await Prospect.create({ userId: user.id, funnelStageId: stage1.id, name: 'In Stage 1' })
    await Prospect.create({ userId: user.id, funnelStageId: stage2.id, name: 'In Stage 2' })

    const response = await client.get(`/api/prospects?funnel_stage_id=${stage1.id}`).loginAs(user)

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.data.length, 1)
    assert.equal(body.data[0].name, 'In Stage 1')
  })

  test('GET /api/prospects?funnel_stage_id returns 422 for non-UUID value', async ({ client }) => {
    const user = await registerUser(client, 'get-filter-bad-uuid')
    const response = await client.get('/api/prospects?funnel_stage_id=not-a-uuid').loginAs(user)
    response.assertStatus(422)
  })

  test('GET /api/prospects?funnel_stage_id returns 404 for another user stage', async ({
    client,
  }) => {
    const userA = await registerUser(client, 'filter-iso-a')
    const userB = await registerUser(client, 'filter-iso-b')
    const stageA = await getFirstStage(userA.id)

    // User B filters by user A's stage — must get 404, not empty list
    const response = await client.get(`/api/prospects?funnel_stage_id=${stageA.id}`).loginAs(userB)
    response.assertStatus(404)
  })

  // ===========================
  // GET /api/prospects/:id
  // ===========================

  test('GET /api/prospects/:id returns the prospect', async ({ client, assert }) => {
    const user = await registerUser(client, 'get-show')
    const stage = await getFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Detail Prospect',
      company: 'ACME Corp',
    })

    const response = await client.get(`/api/prospects/${prospect.id}`).loginAs(user)

    response.assertStatus(200)
    assert.equal(response.body().id, prospect.id)
    assert.equal(response.body().name, 'Detail Prospect')
    assert.equal(response.body().company, 'ACME Corp')
  })

  test('GET /api/prospects/:id returns 404 for non-existent prospect', async ({ client }) => {
    const user = await registerUser(client, 'get-show-404')
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const response = await client.get(`/api/prospects/${fakeId}`).loginAs(user)
    response.assertStatus(404)
  })

  test('GET /api/prospects/:id returns 404 for non-UUID format', async ({ client }) => {
    const user = await registerUser(client, 'get-show-invalid')
    const response = await client.get('/api/prospects/not-a-uuid').loginAs(user)
    response.assertStatus(404)
  })

  // ===========================
  // POST /api/prospects
  // ===========================

  test('POST /api/prospects creates prospect with provided funnel_stage_id', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'post-create')
    const stage = await getFirstStage(user.id)

    const response = await client
      .post('/api/prospects')
      .loginAs(user)
      .json({ name: 'New Prospect', funnel_stage_id: stage.id })

    response.assertStatus(201)
    assert.property(response.body(), 'id')
    assert.equal(response.body().name, 'New Prospect')
    assert.equal(response.body().funnelStageId, stage.id)
  })

  test('POST /api/prospects defaults funnel_stage_id to first active stage', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'post-default-stage')
    const firstStage = await getFirstStage(user.id)

    const response = await client
      .post('/api/prospects')
      .loginAs(user)
      .json({ name: 'Prospect No Stage' })

    response.assertStatus(201)
    assert.equal(
      response.body().funnelStageId,
      firstStage.id,
      'Should default to first active stage',
    )
  })

  test('POST /api/prospects creates prospect with all optional fields', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'post-full')
    const stage = await getFirstStage(user.id)

    const payload = {
      name: 'Full Prospect',
      company: 'Acme Corp',
      linkedin_url: 'https://linkedin.com/in/full',
      email: 'full@example.com',
      phone: '+33612345678',
      title: 'CTO',
      notes: 'Key decision maker',
      funnel_stage_id: stage.id,
    }

    const response = await client.post('/api/prospects').loginAs(user).json(payload)

    response.assertStatus(201)
    assert.equal(response.body().name, payload.name)
    assert.equal(response.body().company, payload.company)
    assert.equal(response.body().email, payload.email)
    assert.equal(response.body().title, payload.title)
  })

  test('POST /api/prospects returns 422 when name is missing', async ({ client }) => {
    const user = await registerUser(client, 'post-no-name')
    const response = await client.post('/api/prospects').loginAs(user).json({})

    response.assertStatus(422)
  })

  test('POST /api/prospects returns 422 when name is empty string', async ({ client }) => {
    const user = await registerUser(client, 'post-empty-name')
    const response = await client.post('/api/prospects').loginAs(user).json({ name: '   ' }) // whitespace only — VineJS trim + minLength(1) rejects

    response.assertStatus(422)
  })

  test('POST /api/prospects returns 422 when email format is invalid', async ({ client }) => {
    const user = await registerUser(client, 'post-bad-email')
    const response = await client
      .post('/api/prospects')
      .loginAs(user)
      .json({ name: 'Test', email: 'not-an-email' })

    response.assertStatus(422)
  })

  test('POST /api/prospects returns 422 when funnel_stage_id is not a valid UUID', async ({
    client,
  }) => {
    const user = await registerUser(client, 'post-bad-stage-uuid')
    const response = await client
      .post('/api/prospects')
      .loginAs(user)
      .json({ name: 'Test', funnel_stage_id: 'not-a-uuid' })

    response.assertStatus(422)
  })

  test('POST /api/prospects returns 422 when user has no active stages', async ({ client }) => {
    const user = await registerUser(client, 'post-no-stages')
    // Archive all user stages so the default funnel_stage_id fallback finds nothing
    const stages = await FunnelStage.query().withScopes((s) => s.forUser(user.id))
    for (const stage of stages) {
      await stage.delete() // SoftDeletes: sets deleted_at
    }

    const response = await client
      .post('/api/prospects')
      .loginAs(user)
      .json({ name: 'Orphan Prospect' })
    response.assertStatus(422)
  })

  // ===========================
  // PUT /api/prospects/:id
  // ===========================

  test('PUT /api/prospects/:id updates the prospect', async ({ client, assert }) => {
    const user = await registerUser(client, 'put-update')
    const stage = await getFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Original',
    })

    const response = await client
      .put(`/api/prospects/${prospect.id}`)
      .loginAs(user)
      .json({ name: 'Updated Name', company: 'New Corp' })

    response.assertStatus(200)
    assert.equal(response.body().id, prospect.id)
    assert.equal(response.body().name, 'Updated Name')
    assert.equal(response.body().company, 'New Corp')
  })

  test('PUT /api/prospects/:id supports partial update (only specified fields change)', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'put-partial')
    const stage = await getFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Partial',
      company: 'Original Corp',
      email: 'original@test.com',
    })

    // Only update name — company and email should remain
    const response = await client
      .put(`/api/prospects/${prospect.id}`)
      .loginAs(user)
      .json({ name: 'Updated Name Only' })

    response.assertStatus(200)
    assert.equal(response.body().name, 'Updated Name Only')
    assert.equal(response.body().company, 'Original Corp', 'Company should be unchanged')
    assert.equal(response.body().email, 'original@test.com', 'Email should be unchanged')
  })

  test('PUT /api/prospects/:id can clear optional fields with null', async ({ client, assert }) => {
    const user = await registerUser(client, 'put-clear')
    const stage = await getFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Clearable',
      company: 'Some Corp',
    })

    const response = await client
      .put(`/api/prospects/${prospect.id}`)
      .loginAs(user)
      .json({ company: null })

    response.assertStatus(200)
    assert.isNull(response.body().company, 'Company should be cleared to null')
  })

  test('PUT /api/prospects/:id can change funnel stage', async ({ client, assert }) => {
    const user = await registerUser(client, 'put-change-stage')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')
    const stage1 = stages[0]
    const stage2 = stages[1]

    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage1.id,
      name: 'Move Me',
    })

    const response = await client
      .put(`/api/prospects/${prospect.id}`)
      .loginAs(user)
      .json({ funnel_stage_id: stage2.id })

    response.assertStatus(200)
    assert.equal(response.body().funnelStageId, stage2.id)
  })

  test('PUT /api/prospects/:id returns 404 for non-existent prospect', async ({ client }) => {
    const user = await registerUser(client, 'put-404')
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const response = await client
      .put(`/api/prospects/${fakeId}`)
      .loginAs(user)
      .json({ name: 'Ghost' })

    response.assertStatus(404)
  })

  test('PUT /api/prospects/:id returns 404 for non-UUID id format', async ({ client }) => {
    const user = await registerUser(client, 'put-invalid-format')
    const response = await client
      .put('/api/prospects/not-a-uuid')
      .loginAs(user)
      .json({ name: 'Test' })

    response.assertStatus(404)
  })

  // ===========================
  // DELETE /api/prospects/:id
  // ===========================

  test('DELETE /api/prospects/:id soft-deletes the prospect', async ({ client, assert }) => {
    const user = await registerUser(client, 'delete-soft')
    const stage = await getFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'To Archive',
    })

    const deleteResponse = await client.delete(`/api/prospects/${prospect.id}`).loginAs(user)
    deleteResponse.assertStatus(200)
    assert.equal(deleteResponse.body().message, 'Prospect archived')

    // Should not appear in active list
    const listResponse = await client.get('/api/prospects').loginAs(user)
    const ids = listResponse.body().data.map((p: ProspectDto) => p.id)
    assert.notInclude(ids, prospect.id, 'Soft-deleted prospect should not appear in active list')

    // Should appear with include_archived=true
    const archivedResponse = await client.get('/api/prospects?include_archived=true').loginAs(user)
    const archivedIds = archivedResponse.body().data.map((p: ProspectDto) => p.id)
    assert.include(
      archivedIds,
      prospect.id,
      'Archived prospect should appear with include_archived=true',
    )

    // Verify deleted_at is set in database
    const softDeleted = await Prospect.query().where('id', prospect.id).withTrashed().first()
    assert.isNotNull(softDeleted?.deletedAt, 'deleted_at should be set')
  })

  test('DELETE /api/prospects/:id returns 404 for non-existent prospect', async ({ client }) => {
    const user = await registerUser(client, 'delete-404')
    const fakeId = '00000000-0000-0000-0000-000000000000'

    const response = await client.delete(`/api/prospects/${fakeId}`).loginAs(user)
    response.assertStatus(404)
  })

  test('DELETE /api/prospects/:id returns 404 for non-UUID id format', async ({ client }) => {
    const user = await registerUser(client, 'delete-invalid-format')
    const response = await client.delete('/api/prospects/not-a-uuid').loginAs(user)
    response.assertStatus(404)
  })

  // ===========================
  // Authentication (AC10)
  // ===========================

  test('returns 401 for unauthenticated GET list request', async ({ client }) => {
    const response = await client.get('/api/prospects')
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated GET show request', async ({ client }) => {
    const response = await client.get('/api/prospects/00000000-0000-0000-0000-000000000000')
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated POST request', async ({ client }) => {
    const response = await client.post('/api/prospects').json({ name: 'Test' })
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated PUT request', async ({ client }) => {
    const response = await client
      .put('/api/prospects/00000000-0000-0000-0000-000000000000')
      .json({ name: 'Test' })
    response.assertStatus(401)
  })

  test('returns 401 for unauthenticated DELETE request', async ({ client }) => {
    const response = await client.delete('/api/prospects/00000000-0000-0000-0000-000000000000')
    response.assertStatus(401)
  })

  // ===========================
  // User Isolation (AC11)
  // ===========================

  test('user isolation: GET list only returns own prospects', async ({ client, assert }) => {
    const userA = await registerUser(client, 'iso-get-a')
    const userB = await registerUser(client, 'iso-get-b')

    const stageA = await getFirstStage(userA.id)
    const prospectA = await Prospect.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'User A Prospect',
    })

    const listRes = await client.get('/api/prospects').loginAs(userB)
    listRes.assertStatus(200)
    const ids = listRes.body().data.map((p: ProspectDto) => p.id)
    assert.notInclude(ids, prospectA.id, "User B should not see user A's prospects")
  })

  test('user isolation: GET show returns 404 for another user prospect', async ({ client }) => {
    const userA = await registerUser(client, 'iso-show-a')
    const userB = await registerUser(client, 'iso-show-b')

    const stageA = await getFirstStage(userA.id)
    const prospectA = await Prospect.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'Private',
    })

    const response = await client.get(`/api/prospects/${prospectA.id}`).loginAs(userB)
    response.assertStatus(404)
  })

  test('user isolation: PUT returns 404 for another user prospect', async ({ client }) => {
    const userA = await registerUser(client, 'iso-put-a')
    const userB = await registerUser(client, 'iso-put-b')

    const stageA = await getFirstStage(userA.id)
    const prospectA = await Prospect.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'Private',
    })

    const response = await client
      .put(`/api/prospects/${prospectA.id}`)
      .loginAs(userB)
      .json({ name: 'Hacked' })

    response.assertStatus(404)
  })

  test('user isolation: DELETE returns 404 for another user prospect', async ({ client }) => {
    const userA = await registerUser(client, 'iso-del-a')
    const userB = await registerUser(client, 'iso-del-b')

    const stageA = await getFirstStage(userA.id)
    const prospectA = await Prospect.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'Private',
    })

    const response = await client.delete(`/api/prospects/${prospectA.id}`).loginAs(userB)
    response.assertStatus(404)
  })

  // ===========================
  // Security: M1 — Cross-user funnel_stage_id (AC8)
  // ===========================

  test('POST: returns 404 when funnel_stage_id belongs to another user', async ({ client }) => {
    const userA = await registerUser(client, 'sec-post-a')
    const userB = await registerUser(client, 'sec-post-b')

    const stageA = await getFirstStage(userA.id)

    // User B tries to create a prospect with user A's funnel stage
    const response = await client
      .post('/api/prospects')
      .loginAs(userB)
      .json({ name: 'Cross-user', funnel_stage_id: stageA.id })

    response.assertStatus(404)
  })

  test('PUT: returns 404 when funnel_stage_id belongs to another user', async ({ client }) => {
    const userA = await registerUser(client, 'sec-put-a')
    const userB = await registerUser(client, 'iso-put-stage-b')

    const stageA = await getFirstStage(userA.id)
    const stageB = await getFirstStage(userB.id)
    const prospectB = await Prospect.create({
      userId: userB.id,
      funnelStageId: stageB.id,
      name: 'Own Prospect',
    })

    // User B tries to move their prospect to user A's funnel stage
    const response = await client
      .put(`/api/prospects/${prospectB.id}`)
      .loginAs(userB)
      .json({ funnel_stage_id: stageA.id })

    response.assertStatus(404)
  })

  // ===========================
  // prospect_count on GET /api/funnel_stages (AC9)
  // ===========================

  test('GET /api/funnel_stages includes prospect_count for each stage', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'pc-count')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')

    // Create 2 prospects in first stage, 0 in second stage
    await Prospect.create({ userId: user.id, funnelStageId: stages[0].id, name: 'P1' })
    await Prospect.create({ userId: user.id, funnelStageId: stages[0].id, name: 'P2' })

    const response = await client.get('/api/funnel_stages').loginAs(user)
    response.assertStatus(200)

    const stagesData = response.body().data
    // Every stage should have prospect_count
    assert.isTrue(
      stagesData.every((s: { prospect_count: unknown }) => typeof s.prospect_count === 'number'),
      'All stages should have a numeric prospect_count',
    )

    const firstStageData = stagesData.find((s: { id: string }) => s.id === stages[0].id)
    assert.equal(firstStageData.prospect_count, 2, 'First stage should have 2 prospects')

    const secondStageData = stagesData.find((s: { id: string }) => s.id === stages[1].id)
    assert.equal(secondStageData.prospect_count, 0, 'Second stage should have 0 prospects')
  })

  test('prospect_count only counts active (non-archived) prospects', async ({ client, assert }) => {
    const user = await registerUser(client, 'pc-active-only')
    const stage = await getFirstStage(user.id)

    const active = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Active',
    })
    const archived = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Archived',
    })
    await archived.delete() // soft-delete

    const response = await client.get('/api/funnel_stages').loginAs(user)
    response.assertStatus(200)

    const stageData = response.body().data.find((s: { id: string }) => s.id === stage.id)
    assert.equal(stageData.prospect_count, 1, 'Only 1 active prospect — archived should not count')
    assert.isDefined(active.id) // active is used — confirm it was created successfully
  })

  // ===========================
  // PATCH /api/prospects/:id/restore
  // ===========================

  test('PATCH /api/prospects/:id/restore restores a soft-deleted prospect', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'restore-ok')
    const stage = await getFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'ToRestore',
    })
    await prospect.delete() // soft-delete first

    const res = await client.patch(`/api/prospects/${prospect.id}/restore`).loginAs(user)
    res.assertStatus(200)
    assert.isNull(res.body().deletedAt)

    // Verify it shows in normal query again (no withTrashed needed)
    const found = await Prospect.query().where('id', prospect.id).first()
    assert.isNotNull(found)
    assert.isNull(found!.deletedAt)
  })

  test("PATCH /api/prospects/:id/restore returns 404 for another user's archived prospect", async ({
    client,
  }) => {
    const user1 = await registerUser(client, 'restore-404-u1')
    const user2 = await registerUser(client, 'restore-404-u2')
    const stage = await getFirstStage(user1.id)
    const prospect = await Prospect.create({
      userId: user1.id,
      funnelStageId: stage.id,
      name: 'NotMineRestore',
    })
    await prospect.delete() // soft-delete

    const res = await client.patch(`/api/prospects/${prospect.id}/restore`).loginAs(user2)
    res.assertStatus(404)
  })

  test('PATCH /api/prospects/:id/restore requires authentication', async ({ client }) => {
    const res = await client.patch('/api/prospects/00000000-0000-0000-0000-000000000001/restore')
    res.assertStatus(401)
  })

  test('PATCH /api/prospects/:id/restore returns 404 for non-existent prospect', async ({
    client,
  }) => {
    const user = await registerUser(client, 'restore-not-found')
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await client.patch(`/api/prospects/${fakeId}/restore`).loginAs(user)
    res.assertStatus(404)
  })

  test('PATCH /api/prospects/:id/restore returns 404 for non-UUID id format', async ({
    client,
  }) => {
    const user = await registerUser(client, 'restore-bad-uuid')
    const res = await client.patch('/api/prospects/not-a-uuid/restore').loginAs(user)
    res.assertStatus(404)
  })

  // ===========================
  // PUT /api/prospects/:id — stage transition recording (FR44)
  // ===========================

  test('PUT /api/prospects/:id records a stage transition when funnel_stage_id changes', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'stage-transition-record')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')
    assert.isAbove(stages.length, 1, 'Need at least 2 stages to test transition')
    const [stage1, stage2] = stages

    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage1.id,
      name: 'MoveMe',
    })

    const res = await client
      .put(`/api/prospects/${prospect.id}`)
      .loginAs(user)
      .json({ funnel_stage_id: stage2.id })

    res.assertStatus(200)
    assert.equal(res.body().funnelStageId, stage2.id)

    const transition = await ProspectStageTransition.query()
      .where('prospect_id', prospect.id)
      .first()

    assert.isNotNull(transition)
    assert.equal(transition!.fromStageId, stage1.id)
    assert.equal(transition!.toStageId, stage2.id)
  })

  test('PUT /api/prospects/:id does NOT record a transition when funnel_stage_id is unchanged', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'stage-no-transition')
    const stage = await getFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'NoMove',
    })

    // Update with same stage ID — should not create a transition
    const res = await client
      .put(`/api/prospects/${prospect.id}`)
      .loginAs(user)
      .json({ funnel_stage_id: stage.id, name: 'NoMove Updated' })

    res.assertStatus(200)

    const count = await ProspectStageTransition.query()
      .where('prospect_id', prospect.id)
      .count('* as total')
    assert.equal(Number(count[0].$extras.total), 0)
  })

  // ===========================
  // GET /api/prospects/:id/stage-transitions (FR44)
  // ===========================

  test('GET /api/prospects/:id/stage-transitions returns empty list when no transitions', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'stage-hist-empty')
    const stage = await getFirstStage(user.id)
    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'HistEmpty',
    })

    const res = await client.get(`/api/prospects/${prospect.id}/stage-transitions`).loginAs(user)
    res.assertStatus(200)
    assert.deepEqual(res.body().data, [])
  })

  test('GET /api/prospects/:id/stage-transitions returns transitions in desc order', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'stage-hist-list')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')
    const [stage1, stage2, stage3] = stages

    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage1.id,
      name: 'HistList',
    })

    // Create transitions directly with explicit timestamps to guarantee deterministic ordering
    // (avoids flakiness from DateTime.now() resolving to the same millisecond in fast CI)
    const now = DateTime.now()
    await ProspectStageTransition.create({
      userId: user.id,
      prospectId: prospect.id,
      fromStageId: stage1.id,
      toStageId: stage2.id,
      transitionedAt: now.minus({ minutes: 1 }), // older
    })
    await ProspectStageTransition.create({
      userId: user.id,
      prospectId: prospect.id,
      fromStageId: stage2.id,
      toStageId: stage3.id,
      transitionedAt: now, // newer
    })

    const res = await client.get(`/api/prospects/${prospect.id}/stage-transitions`).loginAs(user)
    res.assertStatus(200)

    const data = res.body().data
    assert.lengthOf(data, 2)
    // Most recent transition first (stage2 → stage3)
    assert.equal(data[0].fromStageId, stage2.id)
    assert.equal(data[0].toStageId, stage3.id)
    // Older transition second (stage1 → stage2)
    assert.equal(data[1].fromStageId, stage1.id)
    assert.equal(data[1].toStageId, stage2.id)
    // Check stage names and timestamps are present
    assert.isString(data[0].toStageName)
    assert.isString(data[0].transitionedAt)
  })

  test("GET /api/prospects/:id/stage-transitions returns 404 for another user's prospect", async ({
    client,
  }) => {
    const user1 = await registerUser(client, 'stage-hist-404-u1')
    const user2 = await registerUser(client, 'stage-hist-404-u2')
    const stage = await getFirstStage(user1.id)
    const prospect = await Prospect.create({
      userId: user1.id,
      funnelStageId: stage.id,
      name: 'NotMine',
    })

    const res = await client.get(`/api/prospects/${prospect.id}/stage-transitions`).loginAs(user2)
    res.assertStatus(404)
  })

  test('GET /api/prospects/:id/stage-transitions requires authentication', async ({ client }) => {
    const res = await client.get(
      '/api/prospects/00000000-0000-0000-0000-000000000001/stage-transitions',
    )
    res.assertStatus(401)
  })

  test('GET /api/prospects/:id/stage-transitions returns history for archived prospect', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'stage-hist-archived')
    const stages = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')
    const [stage1, stage2] = stages

    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage1.id,
      name: 'ArchivedWithHistory',
    })

    // Record a stage transition while prospect is active
    await client
      .put(`/api/prospects/${prospect.id}`)
      .loginAs(user)
      .json({ funnel_stage_id: stage2.id })

    // Archive the prospect
    await client.delete(`/api/prospects/${prospect.id}`).loginAs(user)

    // Stage history must still be accessible for archived prospects
    const res = await client.get(`/api/prospects/${prospect.id}/stage-transitions`).loginAs(user)
    res.assertStatus(200)
    const data = res.body().data
    assert.lengthOf(data, 1)
    assert.equal(data[0].fromStageId, stage1.id)
    assert.equal(data[0].toStageId, stage2.id)
  })
})
