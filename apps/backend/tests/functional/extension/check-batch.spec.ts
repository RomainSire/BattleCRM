import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import Prospect from '#models/prospect'
import User from '#models/user'

const TEST_DOMAIN = '@test-extension-check-batch.com'

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

test.group('Extension Prospects check-batch', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    await User.query().whereILike('email', `%${TEST_DOMAIN}`).delete()
  })

  test('returns a result for every requested URL (mix of found/not found)', async ({
    client,
    assert,
  }) => {
    const { user, token } = await setupUser(client, 'batch-mix')
    const stage = await getFirstStage(user.id)

    await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'In CRM',
      linkedinUrl: 'https://www.linkedin.com/in/in-crm',
    })

    const res = await client
      .post('/api/extension/prospects/check-batch')
      .header('Authorization', `Bearer ${token}`)
      .json({
        linkedin_urls: [
          'https://www.linkedin.com/in/in-crm',
          'https://www.linkedin.com/in/not-in-crm',
        ],
      })

    res.assertStatus(200)
    const results = res.body().results
    assert.equal(results['https://www.linkedin.com/in/in-crm'], true)
    assert.equal(results['https://www.linkedin.com/in/not-in-crm'], false)
    // Every requested URL must be present in the response
    assert.lengthOf(Object.keys(results), 2)
  })

  test('normalizes URLs (query, hash, trailing slash) when matching and keying', async ({
    client,
    assert,
  }) => {
    const { user, token } = await setupUser(client, 'batch-normalize')
    const stage = await getFirstStage(user.id)

    await Prospect.create({
      userId: user.id,
      funnelStageId: stage.id,
      name: 'Jane',
      linkedinUrl: 'https://www.linkedin.com/in/jane',
    })

    const res = await client
      .post('/api/extension/prospects/check-batch')
      .header('Authorization', `Bearer ${token}`)
      .json({ linkedin_urls: ['https://www.linkedin.com/in/jane/?utm_source=li#about'] })

    res.assertStatus(200)
    const results = res.body().results
    // Key is the normalized URL, value true
    assert.equal(results['https://www.linkedin.com/in/jane'], true)
  })

  test('deduplicates duplicate URLs in the request', async ({ client, assert }) => {
    const { token } = await setupUser(client, 'batch-dedupe')

    const res = await client
      .post('/api/extension/prospects/check-batch')
      .header('Authorization', `Bearer ${token}`)
      .json({
        linkedin_urls: [
          'https://www.linkedin.com/in/dup',
          'https://www.linkedin.com/in/dup/',
          'https://www.linkedin.com/in/dup?trk=x',
        ],
      })

    res.assertStatus(200)
    const results = res.body().results
    assert.lengthOf(Object.keys(results), 1)
    assert.equal(results['https://www.linkedin.com/in/dup'], false)
  })

  test('does not leak prospects belonging to another user', async ({ client, assert }) => {
    const { user: owner } = await setupUser(client, 'batch-owner')
    const { token: outsiderToken } = await setupUser(client, 'batch-outsider')
    const stage = await getFirstStage(owner.id)

    await Prospect.create({
      userId: owner.id,
      funnelStageId: stage.id,
      name: 'Private',
      linkedinUrl: 'https://www.linkedin.com/in/private',
    })

    const res = await client
      .post('/api/extension/prospects/check-batch')
      .header('Authorization', `Bearer ${outsiderToken}`)
      .json({ linkedin_urls: ['https://www.linkedin.com/in/private'] })

    res.assertStatus(200)
    assert.equal(res.body().results['https://www.linkedin.com/in/private'], false)
  })

  test('returns 422 when linkedin_urls is empty', async ({ client, assert }) => {
    const { token } = await setupUser(client, 'batch-empty')

    const res = await client
      .post('/api/extension/prospects/check-batch')
      .header('Authorization', `Bearer ${token}`)
      .json({ linkedin_urls: [] })

    res.assertStatus(422)
    assert.isArray(res.body().errors)
  })

  test('returns 422 when more than 50 URLs are sent', async ({ client, assert }) => {
    const { token } = await setupUser(client, 'batch-toomany')
    const urls = Array.from({ length: 51 }, (_, i) => `https://www.linkedin.com/in/p${i}`)

    const res = await client
      .post('/api/extension/prospects/check-batch')
      .header('Authorization', `Bearer ${token}`)
      .json({ linkedin_urls: urls })

    res.assertStatus(422)
    assert.isArray(res.body().errors)
  })

  test('returns 401 without Bearer token', async ({ client }) => {
    const res = await client
      .post('/api/extension/prospects/check-batch')
      .json({ linkedin_urls: ['https://www.linkedin.com/in/anyone'] })

    res.assertStatus(401)
  })
})
