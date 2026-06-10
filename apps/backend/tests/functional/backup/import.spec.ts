import { randomUUID } from 'node:crypto'
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

const TEST_EMAIL_DOMAIN = '@test-backup-import.com'

// Parser superagent binaire pour lire la réponse `application/gzip` de l'export (round-trip).
type SuperAgentParser = Parameters<typeof ApiRequest.addParser>[1]
const binaryParser: SuperAgentParser = (res, callback) => {
  const stream = res as unknown as NodeJS.ReadableStream
  const chunks: Buffer[] = []
  stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
  stream.on('end', () => callback(null, Buffer.concat(chunks)))
}

test.group('POST /api/backup/import', (group) => {
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
    return User.findOrFail(res.body().user.id)
  }

  /**
   * Construit une enveloppe cohérente (FK internes valides) avec une ligne par table,
   * dont un prospect archivé (deletedAt renseigné). UUID neufs à chaque appel.
   */
  function makeEnvelope(): BackupEnvelope {
    const now = DateTime.now().toUTC().toISO()!
    const stageId = randomUUID()
    const otherStageId = randomUUID()
    const positioningAId = randomUUID()
    const positioningBId = randomUUID()
    const prospectId = randomUUID()
    const archivedProspectId = randomUUID()

    return {
      format: 'battlecrm-backup',
      version: 1,
      exportedAt: now,
      account: { email: 'whatever@example.com', createdAt: now },
      data: {
        funnelStages: [
          {
            id: stageId,
            name: 'Stage One',
            position: 1,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
          {
            id: otherStageId,
            name: 'Stage Two',
            position: 2,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        ],
        prospects: [
          {
            id: prospectId,
            funnelStageId: stageId,
            name: 'Imported Prospect',
            company: 'ACME',
            linkedinUrl: null,
            email: null,
            phone: null,
            title: null,
            notes: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
          {
            id: archivedProspectId,
            funnelStageId: stageId,
            name: 'Imported Archived',
            company: null,
            linkedinUrl: null,
            email: null,
            phone: null,
            title: null,
            notes: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: now,
          },
        ],
        positionings: [
          {
            id: positioningAId,
            funnelStageId: stageId,
            name: 'Variant A',
            description: 'desc',
            content: 'content',
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
          {
            id: positioningBId,
            funnelStageId: stageId,
            name: 'Variant B',
            description: null,
            content: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        ],
        prospectStageTransitions: [
          {
            id: randomUUID(),
            prospectId,
            fromStageId: stageId,
            toStageId: otherStageId,
            transitionedAt: now,
            createdAt: now,
          },
        ],
        prospectPositionings: [
          {
            id: randomUUID(),
            prospectId,
            positioningId: positioningAId,
            funnelStageId: stageId,
            outcome: 'success',
            createdAt: now,
          },
        ],
        interactions: [
          {
            id: randomUUID(),
            prospectId,
            positioningId: positioningAId,
            funnelStageId: stageId,
            notes: 'a note',
            interactionDate: now,
            createdAt: now,
            updatedAt: now,
          },
        ],
        battles: [
          {
            id: randomUUID(),
            funnelStageId: stageId,
            variantAId: positioningAId,
            variantBId: positioningBId,
            battleNumber: 1,
            status: 'active',
            winnerId: null,
            startedAt: now,
            closedAt: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    }
  }

  function gzip(envelope: unknown): Buffer {
    return zlib.gzipSync(Buffer.from(JSON.stringify(envelope), 'utf-8'))
  }

  async function exportEnvelope(client: ApiClient, user: User): Promise<Buffer> {
    const res = await client.get('/api/backup/export').loginAs(user)
    res.assertStatus(200)
    return res.body() as Buffer
  }

  // Crée un jeu de données réel pour un user (réutilise un stage seedé par défaut).
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
      name: 'Seed A',
    })
    const positioningB = await Positioning.create({
      userId,
      funnelStageId: stage.id,
      name: 'Seed B',
    })
    const prospect = await Prospect.create({
      userId,
      funnelStageId: stage.id,
      name: 'Seed Prospect',
    })
    const archived = await Prospect.create({
      userId,
      funnelStageId: stage.id,
      name: 'Seed Archived',
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

  // Compte toutes les lignes (archivés inclus) du user, par table.
  async function counts(userId: string) {
    const [stages, prospects, positionings, transitions, pps, interactions, battles] =
      await Promise.all([
        FunnelStage.withTrashed().withScopes((s) => s.forUser(userId)),
        Prospect.withTrashed().withScopes((s) => s.forUser(userId)),
        Positioning.withTrashed().withScopes((s) => s.forUser(userId)),
        ProspectStageTransition.query().withScopes((s) => s.forUser(userId)),
        ProspectPositioning.query().withScopes((s) => s.forUser(userId)),
        Interaction.query().withScopes((s) => s.forUser(userId)),
        Battle.query().withScopes((s) => s.forUser(userId)),
      ])
    return {
      stages: stages.length,
      prospects: prospects.length,
      positionings: positionings.length,
      transitions: transitions.length,
      pps: pps.length,
      interactions: interactions.length,
      battles: battles.length,
    }
  }

  // ===========================
  // Authentication
  // ===========================

  test('unauthenticated request returns 401', async ({ client }) => {
    const res = await client.post('/api/backup/import').file('file', gzip(makeEnvelope()), {
      filename: 'backup.json.gz',
      contentType: 'application/gzip',
    })
    res.assertStatus(401)
  })

  // ===========================
  // Remplacement total
  // ===========================

  test('replaces all existing data with the file contents', async ({ client, assert }) => {
    const user = await registerUser(client, 'replace')
    await seedData(user.id) // données préexistantes + 9 stages par défaut

    const envelope = makeEnvelope()
    const res = await client
      .post('/api/backup/import')
      .file('file', gzip(envelope), { filename: 'backup.json.gz', contentType: 'application/gzip' })
      .loginAs(user)
    res.assertStatus(200)

    const c = await counts(user.id)
    // L'état correspond EXACTEMENT au fichier (anciennes données + stages par défaut disparus).
    assert.equal(c.stages, 2)
    assert.equal(c.prospects, 2)
    assert.equal(c.positionings, 2)
    assert.equal(c.transitions, 1)
    assert.equal(c.pps, 1)
    assert.equal(c.interactions, 1)
    assert.equal(c.battles, 1)

    // Les ids du fichier sont présents, les anciens absents.
    const imported = (await Prospect.withTrashed()
      .withScopes((s) => s.forUser(user.id))
      .where('id', envelope.data.prospects[0].id)
      .first()) as Prospect | null
    assert.exists(imported)
    assert.equal(imported?.name, 'Imported Prospect')

    // Archivé restauré avec deletedAt renseigné.
    const archived = (await Prospect.withTrashed()
      .withScopes((s) => s.forUser(user.id))
      .where('id', envelope.data.prospects[1].id)
      .firstOrFail()) as Prospect
    assert.isNotNull(archived.deletedAt)
  })

  // ===========================
  // 🔒 Isolation / userId forcé
  // ===========================

  test('forces userId to the current account, ignoring any userId in the file', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'forced')
    const envelope = makeEnvelope()

    // Injecte un userId étranger dans chaque ligne — il DOIT être ignoré.
    const foreignUserId = randomUUID()
    const tampered = JSON.parse(JSON.stringify(envelope))
    for (const rows of Object.values(tampered.data) as Record<string, unknown>[][]) {
      for (const row of rows) {
        row.userId = foreignUserId
      }
    }

    const res = await client
      .post('/api/backup/import')
      .file('file', gzip(tampered), { filename: 'backup.json.gz', contentType: 'application/gzip' })
      .loginAs(user)
    res.assertStatus(200)

    // Aucune ligne restaurée n'appartient au userId étranger.
    const strayProspects = await Prospect.withTrashed().where('user_id', foreignUserId)
    assert.lengthOf(strayProspects, 0)
    // Toutes les données sont bien sous le user courant.
    const c = await counts(user.id)
    assert.equal(c.prospects, 2)
    assert.equal(c.battles, 1)
  })

  test('import by user A never touches user B data', async ({ client, assert }) => {
    const userA = await registerUser(client, 'iso-a')
    const userB = await registerUser(client, 'iso-b')
    const seedB = await seedData(userB.id)
    const beforeB = await counts(userB.id)

    const res = await client
      .post('/api/backup/import')
      .file('file', gzip(makeEnvelope()), {
        filename: 'backup.json.gz',
        contentType: 'application/gzip',
      })
      .loginAs(userA)
    res.assertStatus(200)

    const afterB = await counts(userB.id)
    assert.deepEqual(afterB, beforeB)
    // La donnée de B existe toujours nominativement.
    const stillThere = await Prospect.query()
      .withScopes((s) => s.forUser(userB.id))
      .where('id', seedB.prospect.id)
      .first()
    assert.exists(stillThere)
  })

  // ===========================
  // Atomicité (rollback)
  // ===========================

  test('rolls back entirely when an insert fails (account unchanged)', async ({
    client,
    assert,
  }) => {
    const user = await registerUser(client, 'atomic')
    await seedData(user.id)
    const before = await counts(user.id)

    // Enveloppe structurellement valide mais incohérente : prospect pointant vers un
    // funnelStageId absent du dump → violation FK en cours d'insert → rollback global.
    const envelope = makeEnvelope()
    envelope.data.prospects[0].funnelStageId = randomUUID()

    const res = await client
      .post('/api/backup/import')
      .file('file', gzip(envelope), { filename: 'backup.json.gz', contentType: 'application/gzip' })
      .loginAs(user)
    assert.isAbove(res.status(), 399)

    // Le compte est resté STRICTEMENT dans son état initial.
    const after = await counts(user.id)
    assert.deepEqual(after, before)
  })

  // ===========================
  // Robustesse
  // ===========================

  test('corrupted gzip returns 400', async ({ client }) => {
    const user = await registerUser(client, 'badgzip')
    const res = await client
      .post('/api/backup/import')
      .file('file', Buffer.from('not a gzip stream'), {
        filename: 'backup.json.gz',
        contentType: 'application/gzip',
      })
      .loginAs(user)
    res.assertStatus(400)
  })

  test('valid gzip but invalid JSON returns 400', async ({ client }) => {
    const user = await registerUser(client, 'badjson')
    const res = await client
      .post('/api/backup/import')
      .file('file', zlib.gzipSync(Buffer.from('{ not json', 'utf-8')), {
        filename: 'backup.json.gz',
        contentType: 'application/gzip',
      })
      .loginAs(user)
    res.assertStatus(400)
  })

  test('invalid format returns 422', async ({ client }) => {
    const user = await registerUser(client, 'badformat')
    const envelope = { ...makeEnvelope(), format: 'not-battlecrm' }
    const res = await client
      .post('/api/backup/import')
      .file('file', gzip(envelope), { filename: 'backup.json.gz', contentType: 'application/gzip' })
      .loginAs(user)
    res.assertStatus(422)
  })

  test('unknown version returns 422', async ({ client }) => {
    const user = await registerUser(client, 'badversion')
    const envelope = { ...makeEnvelope(), version: 999 }
    const res = await client
      .post('/api/backup/import')
      .file('file', gzip(envelope), { filename: 'backup.json.gz', contentType: 'application/gzip' })
      .loginAs(user)
    res.assertStatus(422)
  })

  test('missing file returns 422', async ({ client }) => {
    const user = await registerUser(client, 'nofile')
    const res = await client.post('/api/backup/import').loginAs(user)
    res.assertStatus(422)
  })

  // ===========================
  // Round-trip (export → import)
  // ===========================

  test('round-trip: export then import restores the same data', async ({ client, assert }) => {
    const user = await registerUser(client, 'roundtrip')
    await seedData(user.id)
    const before = await counts(user.id)

    const exported = await exportEnvelope(client, user)

    // Ajoute une donnée APRÈS l'export : elle doit disparaître après réimport.
    const stage = await FunnelStage.query()
      .withScopes((s) => s.forUser(user.id))
      .orderBy('position', 'asc')
      .firstOrFail()
    await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'Added After Export' })
    assert.equal((await counts(user.id)).prospects, before.prospects + 1)

    const res = await client
      .post('/api/backup/import')
      .file('file', exported, { filename: 'backup.json.gz', contentType: 'application/gzip' })
      .loginAs(user)
    res.assertStatus(200)

    const after = await counts(user.id)
    assert.deepEqual(after, before)
  })
})
