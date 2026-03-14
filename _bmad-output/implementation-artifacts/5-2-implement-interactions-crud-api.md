# Story 5.2: Implement Interactions CRUD API

Status: review

## Story

As a developer,
I want REST API endpoints to manage interactions,
so that the frontend can log and query interactions.

## Acceptance Criteria

1. **AC1 (GET list):** `GET /api/interactions` returns `{ data: InteractionType[], meta: { total: number } }` for the authenticated user's active interactions, ordered by `interaction_date DESC`. Each item includes: `prospectName`, `prospectFunnelStageId`, `prospectFunnelStageName`, `positioningId`, `positioningName`, `status`, `interactionDate`, `notes`. (FR25)

2. **AC2 (GET filter: prospect):** `GET /api/interactions?prospect_id=:uuid` filters to interactions for that prospect only. Non-UUID → 422. Prospect not found or not owned by user (including archived) → 404. (FR26)

3. **AC3 (GET filter: positioning):** `GET /api/interactions?positioning_id=:uuid` filters to interactions using that positioning. Non-UUID → 422. Positioning not found or not owned by user (including archived) → 404. (FR26)

4. **AC4 (GET filter: status):** `GET /api/interactions?status=positive|pending|negative` filters to interactions with that status. Invalid status value → 422. (FR26)

5. **AC5 (GET filter: funnel_stage):** `GET /api/interactions?funnel_stage_id=:uuid` filters to interactions whose prospect is currently at that funnel stage. Non-UUID → 422. Stage not found or not owned by user → 404.

6. **AC6 (GET single):** `GET /api/interactions/:id` returns a single `InteractionType` for the authenticated user. Non-existent or other user's interaction → 404.

7. **AC7 (POST create):** `POST /api/interactions` with `{ prospect_id, status, positioning_id?, notes?, interaction_date? }` creates an interaction → 201 with `InteractionType`. `prospect_id` required UUID owned by user (including archived prospects → 404 if not found). `interaction_date` defaults to `DateTime.now()` if absent. (FR18, FR19)

8. **AC8 (PUT update):** `PUT /api/interactions/:id` with partial `{ status?, notes?, positioning_id?, interaction_date? }` updates the interaction → 200 with updated `InteractionType`. Ownership enforced (→ 404).

9. **AC9 (DELETE archive):** `DELETE /api/interactions/:id` soft-deletes the interaction → 200 `{ message: 'Interaction archived' }`. Ownership enforced (→ 404). `GET /api/interactions?include_archived=true` includes archived interactions.

10. **AC10 (Serializer):** `serializeInteraction()` in `apps/backend/app/serializers/interaction.ts` maps a fully preloaded `Interaction` model to `InteractionType`. Requires preloaded `prospect` (with nested `funnelStage`, using `withTrashed`) and `positioning`. Preload guards throw descriptive errors. TypeScript enforces the contract. Never return raw `.toJSON()`.

11. **AC11 (Auth + isolation):** All routes require `middleware.auth()`. All queries use `.withScopes(s => s.forUser(userId))`. Unauthenticated → 401.

12. **AC12 (Tests):** `apps/backend/tests/functional/interactions/api.spec.ts` covers all ACs. All tests pass: `ENV_PATH=../../ node ace test functional`.

13. **AC13 (Lint + type-check):** `pnpm biome check --write .` from root — 0 errors. `pnpm type-check` from root — 0 errors.

## Tasks / Subtasks

- [x] **Task 1: Create interaction serializer** (AC10)
  - [x] 1.1 Create `apps/backend/app/serializers/interaction.ts`
  - [x] 1.2 `serializeInteraction(interaction: Interaction): InteractionType` — preload guards + nested `prospect.funnelStage` + optional `positioning`
  - [x] 1.3 Biome import order: `@battlecrm/shared` → `#models/interaction`

- [x] **Task 2: Create interaction validators** (AC7, AC8)
  - [x] 2.1 Create `apps/backend/app/validators/interactions.ts`
  - [x] 2.2 `createInteractionValidator`: `prospect_id` (required uuid), `positioning_id` (optional uuid nullable), `status` (required enum), `notes` (optional string nullable trim), `interaction_date` (optional string)
  - [x] 2.3 `updateInteractionValidator`: all optional with same constraints

- [x] **Task 3: Create interactions controller** (AC1–AC9, AC11)
  - [x] 3.1 Create `apps/backend/app/controllers/interactions_controller.ts`
  - [x] 3.2 `index()` — GET list: forUser, preload `prospect (withTrashed + funnelStage)` + `positioning`, orderBy interaction_date desc; filters: `prospect_id`, `positioning_id`, `status`, `funnel_stage_id`, `include_archived`
  - [x] 3.3 `show()` — GET single by id with full preloads
  - [x] 3.4 `store()` — POST create: validate prospect ownership (`withTrashed`), `interactionDate` defaults to `DateTime.now()`
  - [x] 3.5 `update()` — PUT partial update (reload with preloads before serializing)
  - [x] 3.6 `destroy()` — DELETE soft-delete

- [x] **Task 4: Register routes** (AC11)
  - [x] 4.1 Add `InteractionsController` lazy import in `apps/backend/start/routes.ts`
  - [x] 4.2 Add interactions route group: `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, all parameterized routes with `.where('id', UUID_REGEX)`, `.use(middleware.auth())`

- [x] **Task 5: Functional tests** (AC12)
  - [x] 5.1 Create `apps/backend/tests/functional/interactions/api.spec.ts` (domain: `@test-interactions-api.local`)
  - [x] 5.2 Tests list: GET list shape + prospectName + funnelStageName, ordering by date desc, exclude archived by default, include_archived=true
  - [x] 5.3 Tests filters: `?prospect_id` (valid/invalid uuid/404), `?positioning_id` (valid/invalid/404), `?status` (valid/invalid), `?funnel_stage_id` (valid/invalid/404)
  - [x] 5.4 Tests GET /:id: correct shape, 404 non-existent, 404 cross-user
  - [x] 5.5 Tests POST: create with all fields → 201, create minimal (no positioning, no notes) → 201 positioningName null, no interaction_date → defaults to now, missing status → 422, prospect not owned → 404
  - [x] 5.6 Tests PUT: update status, update notes to null, 404
  - [x] 5.7 Tests DELETE: soft-delete → 200 + excluded from default list, 404
  - [x] 5.8 Tests Auth: unauthenticated → 401 (GET list + POST)
  - [x] 5.9 Tests Isolation: user B cannot access user A's interactions (404 on show/update/delete)
  - [x] 5.10 Run `ENV_PATH=../../ node ace test functional` — 202/202 passent (31 nouveaux, 0 régressions)

- [x] **Task 6: Lint + type-check** (AC13)
  - [x] 6.1 `pnpm biome check --write .` from root — 0 errors (3 auto-fixes style)
  - [x] 6.2 `pnpm type-check` from root — 0 errors

## Dev Notes

### CRITICAL: Serializer — Nested Preload + SoftDeletes

`InteractionType` (défini dans `packages/shared/src/types/interaction.ts` depuis Story 5.1) inclut `prospectName`, `prospectFunnelStageId`, `prospectFunnelStageName`, `positioningName`. Le serializer nécessite :

1. **Prospect preloaded** avec son `funnelStage` preloaded (nested)
2. **Positioning preloaded** (nullable — peut être `null` si `positioningId` est null)

⚠️ **SoftDeletes + preload :** Les prospects archivés (soft-deleted) ne sont PAS chargés par défaut dans les preloads Lucid. Si `interaction.prospect` est un prospect archivé, sans `.withTrashed()` dans le preload, la relation sera `undefined` → crash serializer. **Toujours utiliser `.withTrashed()` dans le preload prospect.**

```typescript
// apps/backend/app/serializers/interaction.ts
import type { InteractionType } from '@battlecrm/shared'
import type Interaction from '#models/interaction'

export function serializeInteraction(interaction: Interaction): InteractionType {
  if (!interaction.prospect) {
    throw new Error(
      'serializeInteraction: prospect relation must be preloaded (use withTrashed if prospect may be archived)',
    )
  }
  if (!interaction.prospect.funnelStage) {
    throw new Error('serializeInteraction: prospect.funnelStage must be preloaded')
  }
  return {
    id: interaction.id,
    userId: interaction.userId,
    prospectId: interaction.prospectId,
    prospectName: interaction.prospect.name,
    prospectFunnelStageId: interaction.prospect.funnelStageId,
    prospectFunnelStageName: interaction.prospect.funnelStage.name,
    positioningId: interaction.positioningId,
    positioningName: interaction.positioning?.name ?? null,
    status: interaction.status,
    notes: interaction.notes,
    interactionDate: interaction.interactionDate.toISO()!,
    createdAt: interaction.createdAt.toISO()!,
    updatedAt: interaction.updatedAt?.toISO() ?? null,
    deletedAt: interaction.deletedAt?.toISO() ?? null,
  }
}
```

Biome import order: `@battlecrm/shared` (`@` scope) → `#models/interaction` (`#` alias).

---

### Task 2: Validators

**File: `apps/backend/app/validators/interactions.ts`** (NOUVEAU)

```typescript
import vine from '@vinejs/vine'

export const createInteractionValidator = vine.compile(
  vine.object({
    prospect_id: vine.string().uuid(),
    positioning_id: vine.string().uuid().nullable().optional(),
    status: vine.enum(['positive', 'pending', 'negative']),
    notes: vine.string().trim().nullable().optional(),
    interaction_date: vine.string().optional(), // ISO 8601 — utilisé tel quel dans DateTime.fromISO()
  }),
)

export const updateInteractionValidator = vine.compile(
  vine.object({
    status: vine.enum(['positive', 'pending', 'negative']).optional(),
    notes: vine.string().trim().nullable().optional(),
    positioning_id: vine.string().uuid().nullable().optional(),
    interaction_date: vine.string().optional(),
  }),
)
```

---

### Task 3: Controller complet

**File: `apps/backend/app/controllers/interactions_controller.ts`** (NOUVEAU)

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { UUID_REGEX } from '#helpers/regex'
import FunnelStage from '#models/funnel_stage'
import Interaction from '#models/interaction'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import { serializeInteraction } from '#serializers/interaction'
import { createInteractionValidator, updateInteractionValidator } from '#validators/interactions'

export default class InteractionsController {
  /**
   * GET /api/interactions
   * Returns active interactions ordered by interaction_date DESC.
   * Filters: ?prospect_id, ?positioning_id, ?status, ?funnel_stage_id, ?include_archived
   */
  async index({ request, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const qs = request.qs()
    const includeArchived = qs.include_archived === 'true'
    const { prospect_id, positioning_id, status, funnel_stage_id } = qs

    const query = Interaction.query()
      .withScopes((s) => s.forUser(userId))
      .preload('prospect', (q) => q.withTrashed().preload('funnelStage'))
      .preload('positioning')
      .orderBy('interaction_date', 'desc')

    if (includeArchived) query.withTrashed()

    if (prospect_id) {
      if (!UUID_REGEX.test(prospect_id)) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.uuid', field: 'prospect_id', rule: 'uuid' }],
        })
      }
      // withTrashed — on peut filtrer les interactions d'un prospect archivé
      const prospect = await Prospect.query()
        .withTrashed()
        .withScopes((s) => s.forUser(userId))
        .where('id', prospect_id)
        .first()
      if (!prospect) return response.notFound()
      query.where('prospect_id', prospect_id)
    }

    if (positioning_id) {
      if (!UUID_REGEX.test(positioning_id)) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.uuid', field: 'positioning_id', rule: 'uuid' }],
        })
      }
      // withTrashed — on peut filtrer par un positioning archivé (données historiques)
      const pos = await Positioning.query()
        .withTrashed()
        .withScopes((s) => s.forUser(userId))
        .where('id', positioning_id)
        .first()
      if (!pos) return response.notFound()
      query.where('positioning_id', positioning_id)
    }

    if (status) {
      if (!['positive', 'pending', 'negative'].includes(status)) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.enum', field: 'status', rule: 'enum' }],
        })
      }
      query.where('status', status)
    }

    if (funnel_stage_id) {
      if (!UUID_REGEX.test(funnel_stage_id)) {
        return response.unprocessableEntity({
          errors: [{ message: 'validation.uuid', field: 'funnel_stage_id', rule: 'uuid' }],
        })
      }
      const stage = await FunnelStage.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', funnel_stage_id)
        .first()
      if (!stage) return response.notFound()
      // funnel_stage_id n'est pas sur interactions — filtrer via la relation prospect
      query.whereHas('prospect', (q) => q.where('funnel_stage_id', funnel_stage_id))
    }

    const interactions = await query
    return response.ok({
      data: interactions.map(serializeInteraction),
      meta: { total: interactions.length },
    })
  }

  /**
   * GET /api/interactions/:id
   */
  async show({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const interaction = await Interaction.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .preload('prospect', (q) => q.withTrashed().preload('funnelStage'))
      .preload('positioning')
      .firstOrFail()
    return response.ok(serializeInteraction(interaction))
  }

  /**
   * POST /api/interactions
   */
  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(createInteractionValidator)
    const userId = auth.user!.id

    // Validate prospect ownership — withTrashed pour inclure les prospects archivés
    await Prospect.query()
      .withTrashed()
      .withScopes((s) => s.forUser(userId))
      .where('id', payload.prospect_id)
      .firstOrFail()

    // Validate positioning ownership si fourni — withTrashed pour inclure les positionings archivés
    if (payload.positioning_id) {
      await Positioning.query()
        .withTrashed()
        .withScopes((s) => s.forUser(userId))
        .where('id', payload.positioning_id)
        .firstOrFail()
    }

    const interaction = await Interaction.create({
      userId,
      prospectId: payload.prospect_id,
      positioningId: payload.positioning_id ?? null,
      status: payload.status,
      notes: payload.notes ?? null,
      interactionDate: payload.interaction_date
        ? DateTime.fromISO(payload.interaction_date)
        : DateTime.now(),
    })

    // Preload pour serializer
    await interaction.load('prospect', (q) => (q as any).withTrashed().preload('funnelStage'))
    await interaction.load('positioning')

    return response.created(serializeInteraction(interaction))
  }

  /**
   * PUT /api/interactions/:id
   */
  async update({ params, request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(updateInteractionValidator)
    const userId = auth.user!.id

    const interaction = await Interaction.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()

    if (payload.status !== undefined) interaction.status = payload.status
    if (payload.notes !== undefined) interaction.notes = payload.notes ?? null
    if (payload.positioning_id !== undefined) interaction.positioningId = payload.positioning_id ?? null
    if (payload.interaction_date !== undefined) {
      interaction.interactionDate = DateTime.fromISO(payload.interaction_date)
    }
    await interaction.save()

    // Reload avec preloads pour le serializer
    const updated = await Interaction.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', interaction.id)
      .preload('prospect', (q) => q.withTrashed().preload('funnelStage'))
      .preload('positioning')
      .firstOrFail()

    return response.ok(serializeInteraction(updated))
  }

  /**
   * DELETE /api/interactions/:id
   * Soft-deletes an interaction.
   */
  async destroy({ params, response, auth }: HttpContext) {
    const userId = auth.user!.id
    const interaction = await Interaction.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', params.id)
      .firstOrFail()
    await interaction.delete()
    return response.ok({ message: 'Interaction archived' })
  }
}
```

**Biome import order:** `@adonisjs/core/http` → `luxon` → `#helpers/regex` → `#models/funnel_stage`, `#models/interaction`, `#models/positioning`, `#models/prospect` → `#serializers/interaction` → `#validators/interactions`.

⚠️ **Note `load()` avec callback en TypeScript :** Si TypeScript se plaint sur `.withTrashed()` dans le callback de `load()`, utiliser un cast `(q as any)` ou passer par `.preload()` sur la query principale plutôt que `.load()` après création.

---

### Task 4: Routes

**File: `apps/backend/start/routes.ts`** — ADD interactions route group :

```typescript
// ADD import (ordre alphabétique — entre FunnelStagesController et PositioningsController) :
const InteractionsController = () => import('#controllers/interactions_controller')

// ADD route group (après positionings group, avant prospects group) :
// Interactions routes — ALL require auth
router
  .group(() => {
    router.get('/', [InteractionsController, 'index'])
    router.post('/', [InteractionsController, 'store'])
    router.get('/:id', [InteractionsController, 'show']).where('id', UUID_REGEX)
    router.put('/:id', [InteractionsController, 'update']).where('id', UUID_REGEX)
    router.delete('/:id', [InteractionsController, 'destroy']).where('id', UUID_REGEX)
  })
  .prefix('/interactions')
  .use(middleware.auth())
```

---

### Task 5: Tests — Pattern Complet

**File: `apps/backend/tests/functional/interactions/api.spec.ts`** (NOUVEAU)

Test domain: `@test-interactions-api.local` (différent de `@interactions-schema-test.local` utilisé en Story 5.1)

```typescript
import db from '@adonisjs/lucid/services/db'
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
    overrides: Partial<{ positioningId: string | null; status: 'positive' | 'pending' | 'negative'; interactionDate: DateTime }> = {},
  ) {
    return Interaction.create({
      userId,
      prospectId,
      positioningId: overrides.positioningId ?? null,
      status: overrides.status ?? 'positive',
      interactionDate: overrides.interactionDate ?? DateTime.now(),
    })
  }
})
```

**Scénarios critiques à implémenter :**

```typescript
// GET list — shape correcte incluant prospectName et funnelStageName
test('GET /api/interactions returns interactions with correct shape', async ({ client, assert }) => {
  const user = await registerUser(client, 'list-shape')
  const stage = await getUserFirstStage(user.id)
  const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'Test Prospect' })
  await createInteraction(user.id, prospect.id)

  const response = await client.get('/api/interactions').loginAs(user)
  response.assertStatus(200)
  const { data, meta } = response.body()
  assert.equal(data[0].prospectName, 'Test Prospect')
  assert.equal(data[0].prospectFunnelStageName, stage.name)
  assert.equal(data[0].status, 'positive')
  assert.isNull(data[0].positioningName)
  assert.isDefined(meta.total)
})

// GET list — ordered by interaction_date desc
test('GET /api/interactions ordered by interaction_date desc', async ({ client, assert }) => {
  const user = await registerUser(client, 'list-order')
  const stage = await getUserFirstStage(user.id)
  const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
  const i1 = await createInteraction(user.id, prospect.id, { interactionDate: DateTime.now().minus({ days: 1 }) })
  const i2 = await createInteraction(user.id, prospect.id, { interactionDate: DateTime.now() })

  const response = await client.get('/api/interactions').loginAs(user)
  response.assertStatus(200)
  assert.equal(response.body().data[0].id, i2.id)
  assert.equal(response.body().data[1].id, i1.id)
})

// filter status invalid → 422
test('GET /api/interactions?status=invalid returns 422', async ({ client }) => {
  const user = await registerUser(client, 'filter-status-invalid')
  const response = await client.get('/api/interactions?status=unknown').loginAs(user)
  response.assertStatus(422)
})

// filter funnel_stage_id — whereHas sur prospect
test('GET /api/interactions?funnel_stage_id filters by prospect funnel stage', async ({ client, assert }) => {
  const user = await registerUser(client, 'filter-stage')
  const stages = await FunnelStage.query().withScopes((s) => s.forUser(user.id)).orderBy('position', 'asc')
  const p1 = await Prospect.create({ userId: user.id, funnelStageId: stages[0].id, name: 'P1' })
  const p2 = await Prospect.create({ userId: user.id, funnelStageId: stages[1].id, name: 'P2' })
  const i1 = await createInteraction(user.id, p1.id)
  await createInteraction(user.id, p2.id)

  const response = await client.get(`/api/interactions?funnel_stage_id=${stages[0].id}`).loginAs(user)
  response.assertStatus(200)
  assert.lengthOf(response.body().data, 1)
  assert.equal(response.body().data[0].id, i1.id)
})

// POST create — interaction_date defaults to now
test('POST /api/interactions without interaction_date defaults to now', async ({ client, assert }) => {
  const user = await registerUser(client, 'post-default-date')
  const stage = await getUserFirstStage(user.id)
  const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })

  const response = await client
    .post('/api/interactions')
    .loginAs(user)
    .json({ prospect_id: prospect.id, status: 'pending' })
  response.assertStatus(201)
  assert.isDefined(response.body().interactionDate)
})

// POST create — avec positioning → positioningName dans la réponse
test('POST /api/interactions with positioning returns positioningName', async ({ client, assert }) => {
  const user = await registerUser(client, 'post-with-positioning')
  const stage = await getUserFirstStage(user.id)
  const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
  const positioning = await Positioning.create({ userId: user.id, funnelStageId: stage.id, name: 'LinkedIn v1' })

  const response = await client
    .post('/api/interactions')
    .loginAs(user)
    .json({ prospect_id: prospect.id, status: 'positive', positioning_id: positioning.id })
  response.assertStatus(201)
  assert.equal(response.body().positioningName, 'LinkedIn v1')
})

// POST create — prospect d'un autre user → 404 (pas 403 — cohérence avec patterns existants)
test('POST /api/interactions with another user prospect returns 404', async ({ client }) => {
  const userA = await registerUser(client, 'iso-post-a')
  const userB = await registerUser(client, 'iso-post-b')
  const stageA = await getUserFirstStage(userA.id)
  const prospectA = await Prospect.create({ userId: userA.id, funnelStageId: stageA.id, name: 'P' })

  const response = await client
    .post('/api/interactions')
    .loginAs(userB)
    .json({ prospect_id: prospectA.id, status: 'positive' })
  response.assertStatus(404)
})

// PUT update — notes to null
test('PUT /api/interactions/:id updates notes to null', async ({ client, assert }) => {
  const user = await registerUser(client, 'put-null-notes')
  const stage = await getUserFirstStage(user.id)
  const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'P' })
  const interaction = await Interaction.create({
    userId: user.id, prospectId: prospect.id, status: 'positive',
    notes: 'some notes', interactionDate: DateTime.now(),
  })

  const response = await client
    .put(`/api/interactions/${interaction.id}`)
    .loginAs(user)
    .json({ notes: null })
  response.assertStatus(200)
  assert.isNull(response.body().notes)
})

// Isolation — user B ne peut pas voir les interactions de user A
test('user isolation: cannot access another user interactions (404)', async ({ client }) => {
  const userA = await registerUser(client, 'iso-a')
  const userB = await registerUser(client, 'iso-b')
  const stageA = await getUserFirstStage(userA.id)
  const prospectA = await Prospect.create({ userId: userA.id, funnelStageId: stageA.id, name: 'P' })
  const interaction = await createInteraction(userA.id, prospectA.id)

  const response = await client.get(`/api/interactions/${interaction.id}`).loginAs(userB)
  response.assertStatus(404)
})

// Auth — unauthenticated → 401
test('GET /api/interactions without auth returns 401', async ({ client }) => {
  const response = await client.get('/api/interactions')
  response.assertStatus(401)
})
```

---

### Pièges connus

1. **SoftDeletes dans les preloads prospect** — TOUJOURS utiliser `.withTrashed()` dans le preload prospect. Sans ça, si le prospect est archivé, `interaction.prospect` sera `undefined` → crash serializer. Ce bug a causé des problèmes en Stories 3.6 et 4.2 (voir project-context.md).

2. **Nested preload `prospect.funnelStage`** — Syntaxe Lucid v3 :
   ```typescript
   .preload('prospect', (q) => q.withTrashed().preload('funnelStage'))
   ```

3. **`positioning` nullable FK** — `.preload('positioning')` sur une interaction avec `positioningId = null` est OK — Lucid retourne `undefined`. Le serializer utilise `interaction.positioning?.name ?? null`. Pas besoin de guard ici.

4. **`interaction_date` non auto** — Setter explicitement dans `store()` :
   ```typescript
   interactionDate: payload.interaction_date ? DateTime.fromISO(payload.interaction_date) : DateTime.now()
   ```
   La DB a un `defaultTo(this.now())` mais Lucid n'a pas `autoCreate` sur ce champ.

5. **`prospect_id` filter + withTrashed** — Lors de la validation ownership pour `?prospect_id=:uuid`, utiliser `.withTrashed()` pour inclure les prospects archivés (l'utilisateur peut légitimement filtrer ses interactions par un prospect archivé).

6. **`whereHas` pour `funnel_stage_id` filter** — `funnel_stage_id` est sur `prospects`, pas sur `interactions`. Utiliser :
   ```typescript
   query.whereHas('prospect', (q) => q.where('funnel_stage_id', funnel_stage_id))
   ```

7. **`withTrashed()` AVANT `withScopes()`** — Pattern établi depuis Story 3.5 :
   ```typescript
   Interaction.query().withTrashed().withScopes((s) => s.forUser(userId))
   ```

8. **Biome import order controller** — `@adonisjs/core/http` → `luxon` → `#helpers/regex` → `#models/funnel_stage`, `#models/interaction`, `#models/positioning`, `#models/prospect` (alphabétique) → `#serializers/interaction` → `#validators/interactions`.

9. **`load()` avec callback TypeScript** — Si TypeScript se plaint sur le type du callback `interaction.load('prospect', (q) => q.withTrashed()...)`, préférer un reload via `.query()` plutôt que `.load()` :
   ```typescript
   const reloaded = await Interaction.query()
     .where('id', interaction.id)
     .preload('prospect', (q) => q.withTrashed().preload('funnelStage'))
     .preload('positioning')
     .firstOrFail()
   return response.created(serializeInteraction(reloaded))
   ```

10. **Nullable fields en mémoire Lucid** — Dans `store()`, `positioningId: payload.positioning_id ?? null` set explicitement à `null` — pas besoin de reload pour l'asserter. En mémoire, la valeur est correcte car settée explicitement.

---

### Project Structure Notes

**Nouveaux fichiers :**
- `apps/backend/app/serializers/interaction.ts`
- `apps/backend/app/validators/interactions.ts`
- `apps/backend/app/controllers/interactions_controller.ts`
- `apps/backend/tests/functional/interactions/api.spec.ts`

**Fichiers modifiés :**
- `apps/backend/start/routes.ts` — add `InteractionsController` import + interactions route group

**Aucun changement shared package** — `InteractionType`, `CreateInteractionPayload`, `UpdateInteractionPayload`, `InteractionsFilterType` déjà définis dans `packages/shared/src/types/interaction.ts` depuis Story 5.1.

**Aucune migration** — schéma complété en Story 5.1. Table `interactions` avec FK, indexes déjà en place.

**Aucun changement model** — `Interaction` model complet depuis Story 5.1. Pas de serializer `serializeInteraction()` en Story 5.1 (contrairement au pattern `PositioningType` en 4.1, l'`InteractionType` était défini mais pas le serializer backend).

---

### Previous Story Intelligence (5.1)

- `Interaction` model : `compose(BaseModel, SoftDeletes)`, `forUser` scope, `belongsTo` User/Prospect/Positioning — prêt
- Migration `0006` appliquée — table `interactions` avec FK, 3 indexes composites
- `InteractionType`, `InteractionListResponse`, `CreateInteractionPayload`, `UpdateInteractionPayload`, `InteractionsFilterType` — tous dans `packages/shared/src/types/interaction.ts` et exportés depuis `index.ts`
- 171 tests existants passant — viser 0 régression
- Test domain Story 5.1 : `@interactions-schema-test.local` → utiliser `@test-interactions-api.local` pour Story 5.2 (isolation des domaines)
- Piège confirmé : `assert.property(model, 'id')` échoue sur Lucid — utiliser `assert.isDefined(model.id)`
- Piège confirmé : nullable fields non settés lors du `.create()` → `undefined` en mémoire, `NULL` en DB. Toujours setter explicitement (`field = payload.field ?? null`)

---

### Git Intelligence Summary

Commits récents (depuis main) :
- `30e623f` Merge PR #26 storu-5.1 — interactions schema merged
- `b57dc0d` feat(interactions): update interactions schema and tests for FK constraints and model relations
- `743f550` feat(interactions): create interactions database schema and model with functional tests

Patterns confirmés :
1. Controller lazy import : `const InteractionsController = () => import('#controllers/interactions_controller')`
2. Route group : `.prefix('/interactions').use(middleware.auth())`
3. `UUID_REGEX` importé de `#helpers/regex` (établi en Story 4.2)
4. Positionings controller a un `restore` endpoint (`PATCH /:id/restore`) — pas nécessaire pour interactions (épic ne le mentionne pas)
5. Tests setup/teardown : `group.setup` + `group.each.teardown` avec email domain unique par story

---

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2] — ACs et FRs (FR18, FR19, FR25, FR26)
- [Source: _bmad-output/implementation-artifacts/4-2-implement-positionings-crud-api.md] — Pattern CRUD complet (controller, serializer, validators, tests, routes)
- [Source: apps/backend/app/controllers/positionings_controller.ts] — Pattern controller, UUID_REGEX, forUser, firstOrFail, sub-resource pattern
- [Source: apps/backend/app/serializers/positioning.ts] — Pattern serializer avec preload guard
- [Source: apps/backend/app/validators/positionings.ts] — Pattern VineJS validators
- [Source: apps/backend/start/routes.ts] — Route registration actuel (pattern à suivre)
- [Source: apps/backend/app/helpers/regex.ts] — UUID_REGEX shared
- [Source: packages/shared/src/types/interaction.ts] — InteractionType complet (Story 5.1)
- [Source: _bmad-output/implementation-artifacts/5-1-create-interactions-database-schema.md] — Model Interaction, SoftDeletes patterns, pièges Lucid documentés
- [Source: _bmad-output/project-context.md#Data Patterns] — SoftDeletes + sub-resource checklist, anti-patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Serializer `serializeInteraction()` uses `(interaction.positioning as Positioning | undefined)?.name ?? null` pour gérer le cas nullable — la relation `BelongsTo` est typée non-nullable par Lucid mais peut être `undefined` au runtime si `positioningId` est null.
- Controller : `.withTrashed()` utilisé dans tous les preloads `prospect` (pattern `q.withTrashed().preload('funnelStage')`) — évite le crash serializer sur prospects archivés.
- `store()` : reload complet via `.query().where('id', ...)` plutôt que `.load()` pour éviter les problèmes de typing du callback avec `withTrashed`.
- Filtre `?funnel_stage_id` implémenté via `.whereHas('prospect', q => q.where('funnel_stage_id', ...))` — le champ n'existe pas sur `interactions`.
- Filtres `?prospect_id` et `?positioning_id` utilisent `.withTrashed()` sur la validation de ownership — permet de filtrer les interactions d'entités archivées.
- 31 tests fonctionnels couvrant tous les ACs (list shape, ordering, filtres x4, GET single, POST full/minimal/default-date, PUT, DELETE, auth 401, isolation cross-user).
- 202/202 tests passent (171 existants + 31 nouveaux) — zéro régressions.
- Biome auto-fixé 3 fichiers (style uniquement), 0 erreurs TypeScript.

### File List

- `apps/backend/app/serializers/interaction.ts` (created)
- `apps/backend/app/validators/interactions.ts` (created)
- `apps/backend/app/controllers/interactions_controller.ts` (created)
- `apps/backend/start/routes.ts` (modified — added InteractionsController import + route group)
- `apps/backend/tests/functional/interactions/api.spec.ts` (created)
