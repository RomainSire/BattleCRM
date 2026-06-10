import zlib from 'node:zlib'
import type { BackupEnvelope } from '@battlecrm/shared'
import type { ApiClient } from '@japa/api-client'
import { ApiRequest } from '@japa/api-client'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import Battle from '#models/battle'
import FunnelStage from '#models/funnel_stage'
import Interaction from '#models/interaction'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import ProspectPositioning from '#models/prospect_positioning'
import ProspectStageTransition from '#models/prospect_stage_transition'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-backup-export.com'

// Parser superagent binaire : la réponse `application/gzip` doit être bufferisée telle
// quelle (pas décodée en utf-8, ce qui corromprait le gzip). Au runtime superagent passe
// l'IncomingMessage (un ReadableStream) ; cast pour satisfaire la signature SuperAgentParser.
type SuperAgentParser = Parameters<typeof ApiRequest.addParser>[1]
const binaryParser: SuperAgentParser = (res, callback) => {
  const stream = res as unknown as NodeJS.ReadableStream
  const chunks: Buffer[] = []
  stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
  stream.on('end', () => callback(null, Buffer.concat(chunks)))
}

test.group('GET /api/backup/export', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
    ApiRequest.addParser('application/gzip', binaryParser)
  })

  group.teardown(() => {
    ApiRequest.removeParser('application/gzip')
  })

  group.each.teardown(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function registerUser(client: ApiClient, prefix: string) {
    const res = await client.post('/api/auth/register').json({
      email: `${prefix}${TEST_EMAIL_DOMAIN}`,
      password: 'password123',
    })
    res.assertStatus(201)
    const userId = res.body().user.id
    return User.findOrFail(userId)
  }

  /**
   * Crée un jeu de données complet pour un user : un prospect archivé inclus,
   * et au moins une ligne dans chaque table du périmètre.
   */
  async function seedData(userId: string) {
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')
      .firstOrFail()
    const otherStage = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')
      .offset(1)
      .firstOrFail()

    const positioningA = await Positioning.create({
      userId,
      funnelStageId: stage.id,
      name: 'Variant A',
      description: 'desc A',
      content: 'content A',
    })
    const positioningB = await Positioning.create({
      userId,
      funnelStageId: stage.id,
      name: 'Variant B',
    })

    const prospect = await Prospect.create({
      userId,
      funnelStageId: stage.id,
      name: 'Active Prospect',
      company: 'ACME',
    })

    // Prospect archivé → doit figurer dans l'export avec deletedAt renseigné.
    const archived = await Prospect.create({
      userId,
      funnelStageId: stage.id,
      name: 'Archived Prospect',
    })
    await archived.delete()

    await ProspectStageTransition.create({
      userId,
      prospectId: prospect.id,
      fromStageId: stage.id,
      toStageId: otherStage.id,
      transitionedAt: DateTime.now(),
    })

    await ProspectPositioning.create({
      userId,
      prospectId: prospect.id,
      positioningId: positioningA.id,
      funnelStageId: stage.id,
      outcome: 'success',
    })

    await Interaction.create({
      userId,
      prospectId: prospect.id,
      positioningId: positioningA.id,
      funnelStageId: stage.id,
      notes: 'a note',
      interactionDate: DateTime.now(),
    })

    await Battle.create({
      userId,
      funnelStageId: stage.id,
      variantAId: positioningA.id,
      variantBId: positioningB.id,
      battleNumber: 1,
      status: 'active',
      winnerId: null,
      startedAt: DateTime.now(),
      closedAt: null,
    })

    return { stage, positioningA, positioningB, prospect, archived }
  }

  function decode(body: Buffer): BackupEnvelope {
    return JSON.parse(zlib.gunzipSync(body).toString('utf-8')) as BackupEnvelope
  }

  // ===========================
  // Authentication
  // ===========================

  test('unauthenticated request returns 401', async ({ client }) => {
    const res = await client.get('/api/backup/export')
    res.assertStatus(401)
  })

  // ===========================
  // Happy path
  // ===========================

  test('returns a gzip attachment with the right headers', async ({ client, assert }) => {
    const user = await registerUser(client, 'headers')
    const res = await client.get('/api/backup/export').loginAs(user)

    res.assertStatus(200)
    res.assertHeader('content-type', 'application/gzip')
    const disposition = res.header('content-disposition') ?? ''
    assert.match(disposition, /attachment; filename="battlecrm-export-\d{4}-\d{2}-\d{2}\.json\.gz"/)
  })

  test('exports a valid, decompressable envelope with all tables present', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'happy')
    await seedData(user.id)

    const res = await client.get('/api/backup/export').loginAs(user)
    res.assertStatus(200)

    const envelope = decode(res.body())
    assert.equal(envelope.format, 'battlecrm-backup')
    assert.equal(envelope.version, 1)
    assert.equal(envelope.account.email, user.email)
    assert.isString(envelope.exportedAt)

    assert.isAbove(envelope.data.funnelStages.length, 0)
    assert.isAbove(envelope.data.prospects.length, 0)
    assert.isAbove(envelope.data.positionings.length, 0)
    assert.lengthOf(envelope.data.prospectStageTransitions, 1)
    assert.lengthOf(envelope.data.prospectPositionings, 1)
    assert.lengthOf(envelope.data.interactions, 1)
    assert.lengthOf(envelope.data.battles, 1)
  })

  test('includes archived (soft-deleted) prospects with deletedAt set', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'archived')
    await seedData(user.id)

    const res = await client.get('/api/backup/export').loginAs(user)
    res.assertStatus(200)

    const envelope = decode(res.body())
    const archived = envelope.data.prospects.find((p) => p.name === 'Archived Prospect')
    assert.exists(archived)
    assert.isString(archived?.deletedAt)

    const active = envelope.data.prospects.find((p) => p.name === 'Active Prospect')
    assert.isNull(active?.deletedAt ?? null)
  })

  test('never exposes userId in any dumped row', async ({ client, assert }) => {
    const user = await registerUser(client, 'nouserid')
    await seedData(user.id)

    const res = await client.get('/api/backup/export').loginAs(user)
    res.assertStatus(200)

    const { data } = decode(res.body())
    const allRows = [
      ...data.funnelStages,
      ...data.prospects,
      ...data.positionings,
      ...data.prospectStageTransitions,
      ...data.prospectPositionings,
      ...data.interactions,
      ...data.battles,
    ]
    for (const row of allRows) {
      assert.notProperty(row, 'userId')
    }
  })

  // ===========================
  // 🔒 Isolation (critique)
  // ===========================

  test('export of user A contains no data belonging to user B', async ({ client, assert }) => {
    const userA = await registerUser(client, 'iso-a')
    const userB = await registerUser(client, 'iso-b')
    const seedA = await seedData(userA.id)
    const seedB = await seedData(userB.id)

    const res = await client.get('/api/backup/export').loginAs(userA)
    res.assertStatus(200)

    const { data } = decode(res.body())
    const positioningIds = data.positionings.map((p) => p.id)
    const prospectIds = data.prospects.map((p) => p.id)

    assert.include(positioningIds, seedA.positioningA.id)
    assert.notInclude(positioningIds, seedB.positioningA.id)
    assert.include(prospectIds, seedA.prospect.id)
    assert.notInclude(prospectIds, seedB.prospect.id)
  })
})
