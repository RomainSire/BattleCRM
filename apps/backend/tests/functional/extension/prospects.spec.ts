import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import Prospect from '#models/prospect'
import User from '#models/user'

const TEST_DOMAIN = '@test-extension-prospects.com'

/** Register via API (creates default funnel stages) then get an extension Bearer token. */
async function setupUser(
  client: ApiClient,
  prefix: string,
): Promise<{ user: User; token: string }> {
  const email = `${prefix}${TEST_DOMAIN}`
  const regRes = await client.post('/api/auth/register').json({ email, password: 'password123' })
  regRes.assertStatus(201)
  const user = await User.findOrFail(regRes.body().user.id)
  const loginRes = await client
    .post('/api/extension/auth/login')
    .json({ email, password: 'password123' })
  loginRes.assertStatus(200)
  return { user, token: loginRes.body().token as string }
}

async function getFirstStage(userId: string): Promise<FunnelStage> {
  return FunnelStage.query()
    .withScopes((s) => s.forUser(userId))
    .orderBy('position', 'asc')
    .firstOrFail()
}

test.group('Extension Prospects API', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    // ON DELETE CASCADE removes funnel_stages, prospects, auth_access_tokens
    await User.query().whereILike('email', `%${TEST_DOMAIN}`).delete()
  })

  // ===========================
  // GET /api/extension/prospects/check
  // ===========================

  test('check returns found:true with prospect data when URL matches', async ({
    client,
    assert,
  }) => {
    const { user, token } = await setupUser(client, 'check-found')
    const stage = await getFirstStage(user.id)

    await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'John Doe',
      linkedinUrl: 'https://linkedin.com/in/johndoe',
      title: 'Engineer',
    })

    const res = await client
      .get('/api/extension/prospects/check')
      .qs({ linkedin_url: 'https://linkedin.com/in/johndoe' })
      .header('Authorization', `Bearer ${token}`)

    res.assertStatus(200)
    const body = res.body()
    assert.isTrue(body.found)
    assert.equal(body.prospect.name, 'John Doe')
    assert.equal(body.prospect.linkedinUrl, 'https://linkedin.com/in/johndoe')
    assert.equal(body.prospect.title, 'Engineer')
    assert.isString(body.prospect.funnelStageName)
    assert.isNotEmpty(body.prospect.funnelStageName)
  })

  test('check returns found:false when URL does not match any prospect', async ({
    client,
    assert,
  }) => {
    const { token } = await setupUser(client, 'check-notfound')

    const res = await client
      .get('/api/extension/prospects/check')
      .qs({ linkedin_url: 'https://linkedin.com/in/nobody' })
      .header('Authorization', `Bearer ${token}`)

    res.assertStatus(200)
    assert.isFalse(res.body().found)
    assert.isUndefined(res.body().prospect)
  })

  test('check normalizes URL by stripping query params', async ({ client, assert }) => {
    const { user, token } = await setupUser(client, 'check-normalize-qs')
    const stage = await getFirstStage(user.id)

    await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Jane Smith',
      linkedinUrl: 'https://linkedin.com/in/janesmith',
    })

    // Request URL has utm tracking params — should still find the prospect
    const res = await client
      .get('/api/extension/prospects/check')
      .qs({ linkedin_url: 'https://linkedin.com/in/janesmith?utm_source=linkedin&trk=nav' })
      .header('Authorization', `Bearer ${token}`)

    res.assertStatus(200)
    assert.isTrue(res.body().found)
    assert.equal(res.body().prospect.name, 'Jane Smith')
  })

  test('check normalizes URL by stripping trailing slash', async ({ client, assert }) => {
    const { user, token } = await setupUser(client, 'check-normalize-slash')
    const stage = await getFirstStage(user.id)

    await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Bob Martin',
      linkedinUrl: 'https://linkedin.com/in/bobmartin',
    })

    const res = await client
      .get('/api/extension/prospects/check')
      .qs({ linkedin_url: 'https://linkedin.com/in/bobmartin/' })
      .header('Authorization', `Bearer ${token}`)

    res.assertStatus(200)
    assert.isTrue(res.body().found)
  })

  test('check returns 422 when linkedin_url is missing', async ({ client, assert }) => {
    const { token } = await setupUser(client, 'check-missing')

    const res = await client
      .get('/api/extension/prospects/check')
      .header('Authorization', `Bearer ${token}`)

    res.assertStatus(422)
    assert.isArray(res.body().errors)
  })

  test('check returns 401 without Bearer token', async ({ client }) => {
    const res = await client
      .get('/api/extension/prospects/check')
      .qs({ linkedin_url: 'https://linkedin.com/in/johndoe' })

    res.assertStatus(401)
  })

  test('check returns found:false for prospect belonging to another user', async ({
    client,
    assert,
  }) => {
    const { user: owner } = await setupUser(client, 'check-other-owner')
    const { token: outsiderToken } = await setupUser(client, 'check-other-outsider')
    const stage = await getFirstStage(owner.id)

    await Prospect.create({
      userId: owner.id,
      funnelStageId: stage.id,
      name: 'Private Person',
      linkedinUrl: 'https://linkedin.com/in/privateperson',
    })

    const res = await client
      .get('/api/extension/prospects/check')
      .qs({ linkedin_url: 'https://linkedin.com/in/privateperson' })
      .header('Authorization', `Bearer ${outsiderToken}`)

    res.assertStatus(200)
    // Must NOT leak that this prospect exists for another user
    assert.isFalse(res.body().found)
  })

  // ===========================
  // POST /api/extension/prospects
  // ===========================

  test('store creates prospect and auto-assigns to first funnel stage', async ({
    client,
    assert,
  }) => {
    const { user, token } = await setupUser(client, 'store-valid')
    const firstStage = await getFirstStage(user.id)

    const res = await client
      .post('/api/extension/prospects')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: 'Alice Engineer',
        linkedin_url: 'https://linkedin.com/in/alice-engineer',
        title: 'Senior Engineer',
        company: 'Acme Corp',
      })

    res.assertStatus(201)
    const body = res.body()
    assert.equal(body.name, 'Alice Engineer')
    assert.equal(body.linkedinUrl, 'https://linkedin.com/in/alice-engineer')
    assert.equal(body.title, 'Senior Engineer')
    assert.equal(body.company, 'Acme Corp')
    assert.equal(body.funnelStageId, firstStage.id)
    assert.isString(body.funnelStageName)
    assert.isNotEmpty(body.funnelStageName)
  })

  test('store normalizes linkedin_url before saving', async ({ client, assert }) => {
    const { user, token } = await setupUser(client, 'store-normalize')

    const res = await client
      .post('/api/extension/prospects')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: 'Normalized Person',
        linkedin_url: 'https://linkedin.com/in/normalized?utm_source=test/',
      })

    res.assertStatus(201)
    // Stored URL should be clean (no query params, no trailing slash)
    assert.equal(res.body().linkedinUrl, 'https://linkedin.com/in/normalized')

    const saved = await Prospect.query()
      .withScopes((s) => s.forUser(user.id))
      .where('linkedin_url', 'https://linkedin.com/in/normalized')
      .first()
    assert.isDefined(saved)
  })

  test('store returns 422 when linkedin_url is missing', async ({ client, assert }) => {
    const { token } = await setupUser(client, 'store-missing-url')

    const res = await client
      .post('/api/extension/prospects')
      .header('Authorization', `Bearer ${token}`)
      .json({ name: 'No URL Person' })

    res.assertStatus(422)
    const errors = res.body().errors
    assert.isTrue(errors.some((e: { field: string }) => e.field === 'linkedin_url'))
  })

  test('store returns 409 when linkedin_url already exists for this user', async ({
    client,
    assert,
  }) => {
    const { user, token } = await setupUser(client, 'store-conflict')
    const stage = await getFirstStage(user.id)

    const existing = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Existing Person',
      linkedinUrl: 'https://linkedin.com/in/existing',
    })

    const res = await client
      .post('/api/extension/prospects')
      .header('Authorization', `Bearer ${token}`)
      .json({
        name: 'Duplicate Person',
        linkedin_url: 'https://linkedin.com/in/existing',
      })

    res.assertStatus(409)
    assert.equal(res.body().message, 'Prospect already exists')
    assert.equal(res.body().prospectId, existing.id)
  })

  test('store returns 401 without Bearer token', async ({ client }) => {
    const res = await client
      .post('/api/extension/prospects')
      .json({ name: 'No Auth', linkedin_url: 'https://linkedin.com/in/noauth' })

    res.assertStatus(401)
  })

  // ===========================
  // PATCH /api/extension/prospects/:id
  // ===========================

  test('update applies partial update and returns 200', async ({ client, assert }) => {
    const { user, token } = await setupUser(client, 'update-valid')
    const stage = await getFirstStage(user.id)

    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Original Name',
      linkedinUrl: 'https://linkedin.com/in/update-valid',
      title: 'Old Title',
    })

    const res = await client
      .patch(`/api/extension/prospects/${prospect.id}`)
      .header('Authorization', `Bearer ${token}`)
      .json({ title: 'New Title', company: 'New Corp' })

    res.assertStatus(200)
    assert.equal(res.body().name, 'Original Name') // unchanged
    assert.equal(res.body().title, 'New Title')
    assert.equal(res.body().company, 'New Corp')
    assert.equal(res.body().linkedinUrl, 'https://linkedin.com/in/update-valid') // unchanged
  })

  test('update ignores linkedin_url if provided in body', async ({ client, assert }) => {
    const { user, token } = await setupUser(client, 'update-ignore-url')
    const stage = await getFirstStage(user.id)

    const prospect = await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Protected URL',
      linkedinUrl: 'https://linkedin.com/in/protected',
    })

    const res = await client
      .patch(`/api/extension/prospects/${prospect.id}`)
      .header('Authorization', `Bearer ${token}`)
      .json({ name: 'New Name', linkedin_url: 'https://linkedin.com/in/hacked' })

    res.assertStatus(200)
    assert.equal(res.body().name, 'New Name')
    // linkedin_url must remain unchanged
    assert.equal(res.body().linkedinUrl, 'https://linkedin.com/in/protected')

    const reloaded = await Prospect.findOrFail(prospect.id)
    assert.equal(reloaded.linkedinUrl, 'https://linkedin.com/in/protected')
  })

  test('update returns 404 for prospect belonging to another user', async ({ client }) => {
    const { user: owner } = await setupUser(client, 'update-owner')
    const { token: outsiderToken } = await setupUser(client, 'update-outsider')
    const stage = await getFirstStage(owner.id)

    const prospect = await Prospect.create({
      userId: owner.id,
      funnelStageId: stage.id,
      name: 'Owners Prospect',
      linkedinUrl: 'https://linkedin.com/in/owners-prospect',
    })

    const res = await client
      .patch(`/api/extension/prospects/${prospect.id}`)
      .header('Authorization', `Bearer ${outsiderToken}`)
      .json({ name: 'Hijacked' })

    res.assertStatus(404)
  })

  test('update returns 401 without Bearer token', async ({ client }) => {
    const res = await client
      .patch('/api/extension/prospects/00000000-0000-0000-0000-000000000000')
      .json({ name: 'No Auth' })

    res.assertStatus(401)
  })
})
