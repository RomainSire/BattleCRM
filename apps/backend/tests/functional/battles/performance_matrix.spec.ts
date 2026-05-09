import type { ConversionCellType } from '@battlecrm/shared'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'
import FunnelStage from '#models/funnel_stage'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import ProspectPositioning from '#models/prospect_positioning'
import User from '#models/user'

const TEST_EMAIL_DOMAIN = '@test-perf-matrix.com'

test.group('GET /api/analytics/performance_matrix', (group) => {
  group.setup(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  group.each.teardown(async () => {
    await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
  })

  async function setupUser(client: ApiClient, prefix: string) {
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
    return { user, stage }
  }

  // ===========================
  // Authentication
  // ===========================

  test('unauthenticated request returns 401', async ({ client }) => {
    const res = await client.get('/api/analytics/performance_matrix')
    res.assertStatus(401)
  })

  // ===========================
  // Empty matrix
  // ===========================

  test('no prospect_positionings → returns empty cells', async ({ client, assert }) => {
    const { user } = await setupUser(client, 'empty')

    const res = await client.get('/api/analytics/performance_matrix').loginAs(user)
    res.assertStatus(200)
    const body = res.body()
    assert.deepEqual(body, { cells: [] })
  })

  // ===========================
  // Correct cell computation
  // ===========================

  test('cells computed correctly: rate, numerator, denominator', async ({ client, assert }) => {
    const { user, stage } = await setupUser(client, 'compute')
    const userId = user.id

    const positioning = await Positioning.create({
      userId,
      funnelStageId: stage.id,
      name: 'Pitch A',
    })
    const prospect1 = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Alice' })
    const prospect2 = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Bob' })
    const prospect3 = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Charlie' })

    // 2 successes out of 3 → Bayesian: (1+2)/(2+3) = 3/5 = 0.6
    await ProspectPositioning.create({
      userId,
      prospectId: prospect1.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: 'success',
    })
    await ProspectPositioning.create({
      userId,
      prospectId: prospect2.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: 'success',
    })
    await ProspectPositioning.create({
      userId,
      prospectId: prospect3.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: 'failed',
    })

    const res = await client.get('/api/analytics/performance_matrix').loginAs(user)
    res.assertStatus(200)
    const { cells } = res.body()

    assert.lengthOf(cells, 1)
    const cell = cells[0]
    assert.equal(cell.positioningId, positioning.id)
    assert.equal(cell.positioningName, 'Pitch A')
    assert.equal(cell.funnelStageId, stage.id)
    assert.equal(cell.numerator, 2)
    assert.equal(cell.denominator, 3)
    assert.approximately(cell.rate, 3 / 5, 0.0001)
    assert.equal(cell.funnelStageName, stage.name)
    assert.equal(cell.confidenceLevel, 'low')
  })

  // ===========================
  // Bayesian smoothing
  // ===========================

  test('Bayesian smoothing: 0 successes / 1 trial → rate ≈ 0.333, not 0', async ({
    client,
    assert,
  }) => {
    const { user, stage } = await setupUser(client, 'bayes-zero')
    const userId = user.id

    const positioning = await Positioning.create({
      userId,
      funnelStageId: stage.id,
      name: 'Variant B',
    })
    const prospect = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Dave' })
    await ProspectPositioning.create({
      userId,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: 'failed',
    })

    const res = await client.get('/api/analytics/performance_matrix').loginAs(user)
    res.assertStatus(200)
    const { cells } = res.body()

    assert.lengthOf(cells, 1)
    assert.approximately(cells[0].rate, 1 / 3, 0.0001)
  })

  test('Bayesian smoothing: 1 success / 1 trial → rate ≈ 0.667, not 1', async ({
    client,
    assert,
  }) => {
    const { user, stage } = await setupUser(client, 'bayes-one')
    const userId = user.id

    const positioning = await Positioning.create({
      userId,
      funnelStageId: stage.id,
      name: 'Variant C',
    })
    const prospect = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Eve' })
    await ProspectPositioning.create({
      userId,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: 'success',
    })

    const res = await client.get('/api/analytics/performance_matrix').loginAs(user)
    res.assertStatus(200)
    const { cells } = res.body()

    assert.lengthOf(cells, 1)
    assert.approximately(cells[0].rate, 2 / 3, 0.0001)
  })

  // ===========================
  // User isolation
  // ===========================

  test('user A cannot see user B cells', async ({ client, assert }) => {
    const { user: userA, stage: stageA } = await setupUser(client, 'isolation-a')
    const { user: userB, stage: stageB } = await setupUser(client, 'isolation-b')

    const posA = await Positioning.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'Pos A',
    })
    const prospA = await Prospect.create({
      userId: userA.id,
      funnelStageId: stageA.id,
      name: 'Frank',
    })
    await ProspectPositioning.create({
      userId: userA.id,
      prospectId: prospA.id,
      positioningId: posA.id,
      funnelStageId: stageA.id,
      outcome: 'success',
    })

    const posB = await Positioning.create({
      userId: userB.id,
      funnelStageId: stageB.id,
      name: 'Pos B',
    })
    const prospB = await Prospect.create({
      userId: userB.id,
      funnelStageId: stageB.id,
      name: 'Grace',
    })
    await ProspectPositioning.create({
      userId: userB.id,
      prospectId: prospB.id,
      positioningId: posB.id,
      funnelStageId: stageB.id,
      outcome: 'failed',
    })

    const resA = await client.get('/api/analytics/performance_matrix').loginAs(userA)
    resA.assertStatus(200)
    const { cells: cellsA } = resA.body()
    assert.lengthOf(cellsA, 1)
    assert.isTrue(cellsA.every((c: ConversionCellType) => c.positioningId === posA.id))

    const resB = await client.get('/api/analytics/performance_matrix').loginAs(userB)
    resB.assertStatus(200)
    const { cells: cellsB } = resB.body()
    assert.lengthOf(cellsB, 1)
    assert.isTrue(cellsB.every((c: ConversionCellType) => c.positioningId === posB.id))
  })

  // ===========================
  // confidenceLevel mapping
  // ===========================

  test('confidenceLevel: low (< 10), medium (10-19), high (≥ 20)', async ({ client, assert }) => {
    const { user } = await setupUser(client, 'confidence')
    const userId = user.id

    const allStages = await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .orderBy('position', 'asc')
    const [stage1, stage2, stage3] = allStages

    // stage1: 3 prospects → 'low'
    const posLow = await Positioning.create({ userId, funnelStageId: stage1.id, name: 'Low' })
    for (let i = 0; i < 3; i++) {
      const p = await Prospect.create({ userId, funnelStageId: stage1.id, name: `Low-${i}` })
      await ProspectPositioning.create({
        userId,
        prospectId: p.id,
        positioningId: posLow.id,
        funnelStageId: stage1.id,
        outcome: null,
      })
    }

    // stage2: 12 prospects → 'medium'
    const posMed = await Positioning.create({ userId, funnelStageId: stage2.id, name: 'Med' })
    for (let i = 0; i < 12; i++) {
      const p = await Prospect.create({ userId, funnelStageId: stage2.id, name: `Med-${i}` })
      await ProspectPositioning.create({
        userId,
        prospectId: p.id,
        positioningId: posMed.id,
        funnelStageId: stage2.id,
        outcome: null,
      })
    }

    // stage3: 20 prospects → 'high'
    const posHigh = await Positioning.create({ userId, funnelStageId: stage3.id, name: 'High' })
    for (let i = 0; i < 20; i++) {
      const p = await Prospect.create({ userId, funnelStageId: stage3.id, name: `High-${i}` })
      await ProspectPositioning.create({
        userId,
        prospectId: p.id,
        positioningId: posHigh.id,
        funnelStageId: stage3.id,
        outcome: null,
      })
    }

    const res = await client.get('/api/analytics/performance_matrix').loginAs(user)
    res.assertStatus(200)
    const { cells } = res.body()

    const lowCell = cells.find((c: ConversionCellType) => c.positioningId === posLow.id)
    const medCell = cells.find((c: ConversionCellType) => c.positioningId === posMed.id)
    const highCell = cells.find((c: ConversionCellType) => c.positioningId === posHigh.id)

    assert.equal(lowCell?.confidenceLevel, 'low')
    assert.equal(medCell?.confidenceLevel, 'medium')
    assert.equal(highCell?.confidenceLevel, 'high')
  })

  // ===========================
  // Archived positionings still appear
  // ===========================

  test('archived positioning still appears in cells (resolved via withTrashed)', async ({
    client,
    assert,
  }) => {
    const { user, stage } = await setupUser(client, 'archived-pos')
    const userId = user.id

    const positioning = await Positioning.create({
      userId,
      funnelStageId: stage.id,
      name: 'Archived Pos',
    })
    const prospect = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Henry' })
    await ProspectPositioning.create({
      userId,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: 'success',
    })

    // Soft-delete the positioning
    await positioning.delete()

    const res = await client.get('/api/analytics/performance_matrix').loginAs(user)
    res.assertStatus(200)
    const { cells } = res.body()

    assert.lengthOf(cells, 1)
    assert.equal(cells[0].positioningId, positioning.id)
    assert.equal(cells[0].positioningName, 'Archived Pos')
  })

  // ===========================
  // Archived funnel stage still appears
  // ===========================

  test('archived funnel stage still appears in cells (resolved via withTrashed)', async ({
    client,
    assert,
  }) => {
    const { user, stage } = await setupUser(client, 'archived-stage')
    const userId = user.id
    const stageName = stage.name

    const positioning = await Positioning.create({
      userId,
      funnelStageId: stage.id,
      name: 'Stage Archive Test',
    })
    const prospect = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Ivan' })
    await ProspectPositioning.create({
      userId,
      prospectId: prospect.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: 'success',
    })

    // Soft-delete the stage directly (bypasses application-level deletion guards)
    await stage.delete()

    const res = await client.get('/api/analytics/performance_matrix').loginAs(user)
    res.assertStatus(200)
    const { cells } = res.body()

    assert.lengthOf(cells, 1)
    assert.equal(cells[0].funnelStageId, stage.id)
    assert.equal(cells[0].funnelStageName, stageName)
  })

  // ===========================
  // Multiple cells
  // ===========================

  test('two positionings for same stage → two distinct cells', async ({ client, assert }) => {
    const { user, stage } = await setupUser(client, 'multi-pos')
    const userId = user.id

    const posA = await Positioning.create({ userId, funnelStageId: stage.id, name: 'Pos Multi A' })
    const posB = await Positioning.create({ userId, funnelStageId: stage.id, name: 'Pos Multi B' })
    const prospect1 = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Iris' })
    const prospect2 = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Jack' })

    await ProspectPositioning.create({
      userId,
      prospectId: prospect1.id,
      positioningId: posA.id,
      funnelStageId: stage.id,
      outcome: 'success',
    })
    await ProspectPositioning.create({
      userId,
      prospectId: prospect2.id,
      positioningId: posB.id,
      funnelStageId: stage.id,
      outcome: 'failed',
    })

    const res = await client.get('/api/analytics/performance_matrix').loginAs(user)
    res.assertStatus(200)
    const { cells } = res.body()

    assert.lengthOf(cells, 2)
    const cellA = cells.find((c: ConversionCellType) => c.positioningId === posA.id)
    const cellB = cells.find((c: ConversionCellType) => c.positioningId === posB.id)
    assert.isDefined(cellA)
    assert.isDefined(cellB)
    assert.equal(cellA?.positioningName, 'Pos Multi A')
    assert.equal(cellA?.funnelStageId, stage.id)
    assert.equal(cellA?.funnelStageName, stage.name)
    assert.equal(cellB?.funnelStageName, stage.name)
    assert.equal(cellA?.numerator, 1)
    assert.equal(cellA?.denominator, 1)
    assert.equal(cellB?.numerator, 0)
    assert.equal(cellB?.denominator, 1)
  })

  // ===========================
  // outcome = null in denominator
  // ===========================

  test('outcome = null counts in denominator but not numerator', async ({ client, assert }) => {
    const { user, stage } = await setupUser(client, 'null-outcome')
    const userId = user.id

    const positioning = await Positioning.create({
      userId,
      funnelStageId: stage.id,
      name: 'Null Test',
    })
    const p1 = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Kate' })
    const p2 = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Leo' })
    const p3 = await Prospect.create({ userId, funnelStageId: stage.id, name: 'Mia' })

    // 1 success, 1 null, 1 failed → numerator = 1, denominator = 3
    await ProspectPositioning.create({
      userId,
      prospectId: p1.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: 'success',
    })
    await ProspectPositioning.create({
      userId,
      prospectId: p2.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: null,
    })
    await ProspectPositioning.create({
      userId,
      prospectId: p3.id,
      positioningId: positioning.id,
      funnelStageId: stage.id,
      outcome: 'failed',
    })

    const res = await client.get('/api/analytics/performance_matrix').loginAs(user)
    res.assertStatus(200)
    const { cells } = res.body()

    assert.lengthOf(cells, 1)
    assert.equal(cells[0].numerator, 1)
    assert.equal(cells[0].denominator, 3)
    // Bayesian: (1+1)/(2+3) = 2/5 = 0.4
    assert.approximately(cells[0].rate, 2 / 5, 0.0001)
  })
  // Note: positioningName and funnelStageName can be null (shared type: string | null).
  // Hard-deleting a referenced positioning is blocked by the FK RESTRICT constraint on
  // prospect_positionings.positioning_id — the null path is unreachable in normal operation.
  // The ?? null fallback is defensive code; soft-deleted positionings are found via withTrashed().
})
