# Story 3.6: Implement Funnel Stage Management

Status: ready-for-dev

<!-- Ultimate Context Engine Analysis: 2026-03-01 -->
<!-- Epic 3: Prospect Management — backend + frontend story (new migration/model + UI) -->

## Story

As a user,
I want to move prospects between funnel stages and see their progression history,
so that I can track their advancement through my pipeline.

## Acceptance Criteria

1. **AC1 (Inline stage change):** In the expanded `ProspectRow` panel (read-only mode), an active (non-archived) prospect shows a stage `<Select>` pre-filled with the current stage. Changing the select immediately calls `PUT /api/prospects/:id` with `{ funnel_stage_id }`. On success: `toast.success(...)` confirms the change. On error: inline error message below the select — **never `toast.error()`**.

2. **AC2 (List filtering respects stage change):** When the prospects list is filtered by a funnel stage and the user moves a prospect to a different stage, the prospect disappears from the current view after the query invalidation (TanStack Query `invalidateQueries`). This requires no additional implementation — it's a consequence of correct cache invalidation in the mutation hook.

3. **AC3 (Progression history):** In the expanded `ProspectRow` panel, a "Stage History" section shows a timeline of all stage transitions for that prospect (fetched lazily, only when row is expanded). Each entry shows: `From Stage → To Stage` and the timestamp. When no transitions have been recorded yet, a placeholder message is shown.

4. **AC4 (Visual stage indicator):** In the expanded `ProspectRow` panel, the stage selector is labelled with the prospect's current position in the funnel (e.g., "Funnel Stage — 2 of 9"). This gives the user context about progression depth.

5. **AC5 (Backend — stage transitions recording):** `PUT /api/prospects/:id` detects when `funnel_stage_id` changes (old vs new value differs). If it changes, a new `prospect_stage_transitions` row is created with `from_stage_id` (previous), `to_stage_id` (new), and `transitioned_at = now()`. The transition is recorded AFTER the prospect is saved (no rollback needed for this secondary record).

6. **AC6 (Backend — transitions endpoint):** `GET /api/prospects/:id/stage-transitions` returns the list of transitions for that prospect, ordered by `transitioned_at DESC`. Each item includes `id`, `fromStageId`, `fromStageName` (nullable), `toStageId`, `toStageName`, `transitionedAt`. Returns 404 if prospect not found or belongs to another user.

7. **AC7 (Lint + type-check):** `pnpm biome check --write .` from root passes with 0 errors. `pnpm --filter @battlecrm/frontend type-check` passes with 0 errors.

## Tasks / Subtasks

- [ ] **Task 1: Backend — migration and model** (AC5, AC6)
  - [ ] 1.1 Create migration `apps/backend/database/migrations/0004_create_prospect_stage_transitions_table.ts`
  - [ ] 1.2 Create model `apps/backend/app/models/prospect_stage_transition.ts`
  - [ ] 1.3 Update `apps/backend/app/models/prospect.ts` — add `hasMany(() => ProspectStageTransition)` relation

- [ ] **Task 2: Backend — controller and routes** (AC5, AC6)
  - [ ] 2.1 Update `update()` in `apps/backend/app/controllers/prospects_controller.ts` — record transition when `funnel_stage_id` changes
  - [ ] 2.2 Add `stageTransitions()` action to `ProspectsController`
  - [ ] 2.3 Add `GET /:id/stage-transitions` route in `apps/backend/start/routes.ts`

- [ ] **Task 3: Backend — functional tests** (AC5, AC6)
  - [ ] 3.1 Add tests in `apps/backend/tests/functional/prospects/api.spec.ts`

- [ ] **Task 4: Frontend — API layer** (AC1, AC3)
  - [ ] 4.1 Add `funnel_stage_id?: string` to `UpdateProspectPayload` in `apps/frontend/src/features/prospects/lib/api.ts`
  - [ ] 4.2 Add `StageTransitionType` type
  - [ ] 4.3 Add `prospectsApi.stageTransitions(id)` method

- [ ] **Task 5: Frontend — query keys and hook** (AC3)
  - [ ] 5.1 Add `prospects.stageTransitions(id)` key to `apps/frontend/src/lib/queryKeys.ts`
  - [ ] 5.2 Create `apps/frontend/src/features/prospects/hooks/useProspectStageTransitions.ts`

- [ ] **Task 6: Frontend — ProspectRow UI** (AC1, AC3, AC4)
  - [ ] 6.1 Add stage `<Select>` in read-only expanded panel (active prospects only)
  - [ ] 6.2 Add `handleStageChange` handler (uses existing `useUpdateProspect`)
  - [ ] 6.3 Add "Stage X of N" label using `useFunnelStages()` (cached, no extra API call)
  - [ ] 6.4 Add stage transitions timeline section

- [ ] **Task 7: i18n translations** (all ACs)
  - [ ] 7.1 Add new keys to `apps/frontend/public/locales/en.json`
  - [ ] 7.2 Add new keys to `apps/frontend/public/locales/fr.json`

- [ ] **Task 8: Lint and type-check** (AC7)
  - [ ] 8.1 `pnpm biome check --write .` from root — 0 errors
  - [ ] 8.2 `pnpm --filter @battlecrm/frontend type-check` — 0 errors

---

## Dev Notes

### CRITICAL: Backend Already Supports Stage Change via PUT /api/prospects/:id

The `update()` controller action ALREADY handles `funnel_stage_id` changes, including the M1 security validation (verifies stage belongs to authenticated user). **Do NOT rewrite this logic.** Task 2.1 only requires adding transition recording AROUND the existing logic.

Current flow in `update()`:
```typescript
if (payload.funnel_stage_id !== undefined) {
  await FunnelStage.query()
    .withScopes((s) => s.forUser(userId))
    .where('id', payload.funnel_stage_id)
    .firstOrFail()  // ← M1 security check — 404 if not user's stage
  prospect.funnelStageId = payload.funnel_stage_id
}
// ... other field updates ...
await prospect.save()
```

Your Task 2.1 adds transition recording AFTER `prospect.save()` — see detailed code below.

---

### Task 1.1: Migration — prospect_stage_transitions

**File: `apps/backend/database/migrations/0004_create_prospect_stage_transitions_table.ts`**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'prospect_stage_transitions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('prospect_id').notNullable().references('id').inTable('prospects').onDelete('CASCADE')

      // from_stage_id: nullable (null = initial stage assignment, no "from")
      // funnel_stages are only ever soft-deleted — DB row always exists, FK is safe
      table.uuid('from_stage_id').nullable().references('id').inTable('funnel_stages')
      table.uuid('to_stage_id').notNullable().references('id').inTable('funnel_stages')

      table.timestamp('transitioned_at').notNullable()
      table.timestamp('created_at').notNullable()

      // Index for per-prospect history queries (chronological)
      table.index(['prospect_id', 'transitioned_at'], 'idx_stage_transitions_prospect_time')
      // Index for user-scoped queries (security boundary)
      table.index(['user_id', 'prospect_id'], 'idx_stage_transitions_user_prospect')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

**Run migration:** `ENV_PATH=../../ node ace migration:run` (from `apps/backend/`)

---

### Task 1.2: Model — ProspectStageTransition

**File: `apps/backend/app/models/prospect_stage_transition.ts`** (NEW FILE)

```typescript
import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import FunnelStage from '#models/funnel_stage'
import Prospect from '#models/prospect'
import User from '#models/user'

export default class ProspectStageTransition extends BaseModel {
  static table = 'prospect_stage_transitions'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare prospectId: string

  @column()
  declare fromStageId: string | null

  @column()
  declare toStageId: string

  @column.dateTime()
  declare transitionedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Primary user isolation mechanism — mirrors Prospect and FunnelStage scope pattern
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Prospect)
  declare prospect: BelongsTo<typeof Prospect>

  @belongsTo(() => FunnelStage, { foreignKey: 'fromStageId' })
  declare fromStage: BelongsTo<typeof FunnelStage>

  @belongsTo(() => FunnelStage, { foreignKey: 'toStageId' })
  declare toStage: BelongsTo<typeof FunnelStage>
}
```

**No SoftDeletes** — transitions are immutable audit records. No soft-delete needed.

---

### Task 1.3: Update Prospect Model

**File: `apps/backend/app/models/prospect.ts`** — ADD at the bottom of the class:

```typescript
// ADD new import at top of file:
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, hasMany, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
// ... existing imports ...
import ProspectStageTransition from '#models/prospect_stage_transition'

// ADD inside the class, after the existing belongsTo relations:
@hasMany(() => ProspectStageTransition)
declare stageTransitions: HasMany<typeof ProspectStageTransition>
```

⚠️ Biome alphabetically sorts imports: `@adonisjs/...` before `#models/...`. The `ProspectStageTransition` import goes with the other `#models/` imports, alphabetically.

---

### Task 2.1: Update ProspectsController.update() — Record Transition

**File: `apps/backend/app/controllers/prospects_controller.ts`** — MODIFY `update()`:

Add import at top:
```typescript
import ProspectStageTransition from '#models/prospect_stage_transition'
import { DateTime } from 'luxon'
```

Modify `update()` action — add transition recording after `prospect.save()`:

```typescript
async update({ params, request, response, auth }: HttpContext) {
  const payload = await request.validateUsing(updateProspectValidator)
  const userId = auth.user!.id

  const prospect = await Prospect.query()
    .withScopes((s) => s.forUser(userId))
    .where('id', params.id)
    .firstOrFail()

  // Capture previous stage BEFORE any changes (for transition recording)
  const previousStageId = prospect.funnelStageId

  // SECURITY (M1): if changing funnel stage, validate it belongs to the authenticated user
  if (payload.funnel_stage_id !== undefined) {
    await FunnelStage.query()
      .withScopes((s) => s.forUser(userId))
      .where('id', payload.funnel_stage_id)
      .firstOrFail()
    prospect.funnelStageId = payload.funnel_stage_id
  }

  if (payload.name !== undefined) prospect.name = payload.name
  if (payload.company !== undefined) prospect.company = payload.company ?? null
  if (payload.linkedin_url !== undefined) prospect.linkedinUrl = payload.linkedin_url ?? null
  if (payload.email !== undefined) prospect.email = payload.email ?? null
  if (payload.phone !== undefined) prospect.phone = payload.phone ?? null
  if (payload.title !== undefined) prospect.title = payload.title ?? null
  if (payload.notes !== undefined) prospect.notes = payload.notes ?? null
  if (payload.positioning_id !== undefined)
    prospect.positioningId = payload.positioning_id ?? null

  await prospect.save()

  // Record stage transition if funnel_stage_id actually changed
  if (
    payload.funnel_stage_id !== undefined &&
    payload.funnel_stage_id !== previousStageId
  ) {
    await ProspectStageTransition.create({
      userId,
      prospectId: prospect.id,
      fromStageId: previousStageId,
      toStageId: payload.funnel_stage_id,
      transitionedAt: DateTime.now(),
    })
  }

  return response.ok(prospect)
}
```

**Key logic:** Only record a transition if the stage ACTUALLY changed (new ID ≠ old ID). This prevents spurious history entries when `PUT` is called with the same stage.

---

### Task 2.2: Add stageTransitions() Action

**File: `apps/backend/app/controllers/prospects_controller.ts`** — ADD after `restore()`:

```typescript
/**
 * GET /api/prospects/:id/stage-transitions
 * Returns stage transition history for a prospect, ordered by transitioned_at DESC.
 * Only returns transitions for the authenticated user's prospect.
 */
async stageTransitions({ params, response, auth }: HttpContext) {
  const userId = auth.user!.id

  // Verify prospect exists and belongs to authenticated user (consistent with show() pattern)
  const prospect = await Prospect.query()
    .withScopes((s) => s.forUser(userId))
    .where('id', params.id)
    .firstOrFail()

  const transitions = await ProspectStageTransition.query()
    .where('prospect_id', prospect.id)
    .preload('fromStage')
    .preload('toStage')
    .orderBy('transitioned_at', 'desc')

  return response.ok({
    data: transitions.map((t) => ({
      id: t.id,
      fromStageId: t.fromStageId,
      fromStageName: t.fromStage?.name ?? null,
      toStageId: t.toStageId,
      toStageName: t.toStage?.name ?? 'Unknown stage',
      transitionedAt: t.transitionedAt,
    })),
  })
}
```

**Note on preload with soft-deleted stages:** `FunnelStage` uses `SoftDeletes` mixin. If a stage was soft-deleted after a transition was recorded, `preload('fromStage')` may return `null` for that relation (the DB row still exists, but the default scope excludes `deleted_at IS NOT NULL`). The `?? null` and `?? 'Unknown stage'` fallbacks handle this gracefully.

If strict historical accuracy is needed (see also: can test with a soft-deleted stage), adjust preload to include trashed:
```typescript
.preload('fromStage', (q) => (q as any).withTrashed())
.preload('toStage', (q) => (q as any).withTrashed())
```
The `as any` cast is needed because `withTrashed()` from `adonis-lucid-soft-deletes` is not in Lucid's default query builder types (types are augmented in `apps/backend/types/soft_deletes.d.ts` for model queries, but may not apply inside preload callbacks).

---

### Task 2.3: Routes — Add stage-transitions Route

**File: `apps/backend/start/routes.ts`** — ADD inside the `/prospects` group, AFTER the `/:id/restore` route:

```typescript
router
  .group(() => {
    router.get('/', [ProspectsController, 'index'])
    router.post('/', [ProspectsController, 'store'])
    router.get('/:id', [ProspectsController, 'show']).where('id', UUID_REGEX)
    router.put('/:id', [ProspectsController, 'update']).where('id', UUID_REGEX)
    router.delete('/:id', [ProspectsController, 'destroy']).where('id', UUID_REGEX)
    router.patch('/:id/restore', [ProspectsController, 'restore']).where('id', UUID_REGEX)
    router.get('/:id/stage-transitions', [ProspectsController, 'stageTransitions']).where('id', UUID_REGEX)
  })
  .prefix('/prospects')
  .use(middleware.auth())
```

⚠️ `/:id/stage-transitions` is a GET with 2 path segments — no conflict with `/:id` (which is also GET but single segment). Both can coexist.

---

### Task 3: Backend Functional Tests

**File: `apps/backend/tests/functional/prospects/api.spec.ts`** — ADD tests at the end:

```typescript
// ===========================
// PUT /api/prospects/:id — stage transition recording
// ===========================

test('PUT /api/prospects/:id records a stage transition when funnel_stage_id changes', async ({ client, assert }) => {
  const user = await registerUser(client, 'stage-transition-record')
  const stages = await FunnelStage.query().withScopes((s) => s.forUser(user.id)).orderBy('position', 'asc')
  assert.isAbove(stages.length, 1, 'Need at least 2 stages to test transition')
  const [stage1, stage2] = stages

  const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage1.id, name: 'MoveMe' })

  const res = await client.put(`/api/prospects/${prospect.id}`)
    .loginAs(user)
    .json({ funnel_stage_id: stage2.id })

  res.assertStatus(200)
  assert.equal(res.body().funnelStageId, stage2.id)

  const { default: ProspectStageTransition } = await import('#models/prospect_stage_transition')
  const transition = await ProspectStageTransition.query()
    .where('prospect_id', prospect.id)
    .first()

  assert.isNotNull(transition)
  assert.equal(transition!.fromStageId, stage1.id)
  assert.equal(transition!.toStageId, stage2.id)
})

test('PUT /api/prospects/:id does NOT record a transition when funnel_stage_id is unchanged', async ({ client, assert }) => {
  const user = await registerUser(client, 'stage-no-transition')
  const stage = await getFirstStage(user.id)
  const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'NoMove' })

  // Update with same stage ID
  const res = await client.put(`/api/prospects/${prospect.id}`)
    .loginAs(user)
    .json({ funnel_stage_id: stage.id, name: 'NoMove Updated' })

  res.assertStatus(200)

  const { default: ProspectStageTransition } = await import('#models/prospect_stage_transition')
  const count = await ProspectStageTransition.query()
    .where('prospect_id', prospect.id)
    .count('* as total')
  assert.equal(Number(count[0].$extras.total), 0)
})

// ===========================
// GET /api/prospects/:id/stage-transitions
// ===========================

test('GET /api/prospects/:id/stage-transitions returns empty list when no transitions', async ({ client, assert }) => {
  const user = await registerUser(client, 'stage-hist-empty')
  const stage = await getFirstStage(user.id)
  const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage.id, name: 'HistEmpty' })

  const res = await client.get(`/api/prospects/${prospect.id}/stage-transitions`).loginAs(user)
  res.assertStatus(200)
  assert.deepEqual(res.body().data, [])
})

test('GET /api/prospects/:id/stage-transitions returns transitions in desc order', async ({ client, assert }) => {
  const user = await registerUser(client, 'stage-hist-list')
  const stages = await FunnelStage.query().withScopes((s) => s.forUser(user.id)).orderBy('position', 'asc')
  const [stage1, stage2, stage3] = stages

  const prospect = await Prospect.create({ userId: user.id, funnelStageId: stage1.id, name: 'HistList' })

  // Make two stage changes
  await client.put(`/api/prospects/${prospect.id}`).loginAs(user).json({ funnel_stage_id: stage2.id })
  await client.put(`/api/prospects/${prospect.id}`).loginAs(user).json({ funnel_stage_id: stage3.id })

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
  // Check stage names are present
  assert.isDefined(data[0].toStageName)
  assert.isDefined(data[0].transitionedAt)
})

test('GET /api/prospects/:id/stage-transitions returns 404 for another user\'s prospect', async ({ client }) => {
  const user1 = await registerUser(client, 'stage-hist-404-u1')
  const user2 = await registerUser(client, 'stage-hist-404-u2')
  const stage = await getFirstStage(user1.id)
  const prospect = await Prospect.create({ userId: user1.id, funnelStageId: stage.id, name: 'NotMine' })

  const res = await client.get(`/api/prospects/${prospect.id}/stage-transitions`).loginAs(user2)
  res.assertStatus(404)
})

test('GET /api/prospects/:id/stage-transitions requires authentication', async ({ client }) => {
  const res = await client.get('/api/prospects/00000000-0000-0000-0000-000000000001/stage-transitions')
  res.assertStatus(401)
})
```

**Test infrastructure notes:**
- `FunnelStage` needs to be imported at top of test file if not already: `import FunnelStage from '#models/funnel_stage'`
- `registerUser` and `getFirstStage` helpers are already defined in the test file
- `getFirstStage` returns the stage with the lowest `position` for a given `userId` — use it to get `stage1`
- For tests needing multiple stages, query directly: `FunnelStage.query().withScopes((s) => s.forUser(user.id)).orderBy('position', 'asc')` — default stages from Story 2.1 seed give 9 stages per user
- The dynamic import `await import('#models/prospect_stage_transition')` may not work in test context. Prefer a top-level import: `import ProspectStageTransition from '#models/prospect_stage_transition'`

---

### Task 4: Frontend API Layer

**File: `apps/frontend/src/features/prospects/lib/api.ts`** — MODIFY:

```typescript
// Add funnel_stage_id to UpdateProspectPayload:
export type UpdateProspectPayload = {
  name?: string
  funnel_stage_id?: string         // ← ADD THIS — Stage change from expanded row
  company?: string | null
  linkedin_url?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  notes?: string | null
}

// ADD new type after ProspectsFilterType:
export type StageTransitionType = {
  id: string
  fromStageId: string | null
  fromStageName: string | null
  toStageId: string
  toStageName: string
  transitionedAt: string  // ISO 8601 timestamp
}

export type StageTransitionsResponseType = {
  data: StageTransitionType[]
}

// ADD to prospectsApi object, after restore():
stageTransitions(id: string): Promise<StageTransitionsResponseType> {
  return fetchApi<StageTransitionsResponseType>(`/prospects/${id}/stage-transitions`)
},
```

---

### Task 5.1: Update queryKeys.ts

**File: `apps/frontend/src/lib/queryKeys.ts`** — ADD to `prospects` section:

```typescript
export const queryKeys = {
  // ... existing auth, funnelStages ...
  prospects: {
    all: ['prospects'] as const,
    list: (filters?: { funnel_stage_id?: string; include_archived?: boolean }) =>
      filters && Object.keys(filters).length > 0
        ? ([...queryKeys.prospects.all, 'list', filters] as const)
        : ([...queryKeys.prospects.all, 'list'] as const),
    detail: (id: string) => [...queryKeys.prospects.all, 'detail', id] as const,
    stageTransitions: (id: string) =>
      [...queryKeys.prospects.all, 'stage-transitions', id] as const,  // ← ADD
  },
}
```

---

### Task 5.2: New Hook — useProspectStageTransitions

**File: `apps/frontend/src/features/prospects/hooks/useProspectStageTransitions.ts`** (NEW FILE)

```typescript
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { prospectsApi } from '../lib/api'

export function useProspectStageTransitions(prospectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.prospects.stageTransitions(prospectId),
    queryFn: () => prospectsApi.stageTransitions(prospectId),
    enabled: options?.enabled ?? true,
  })
}
```

**Pattern:** Same as `useFunnelStages()` — simple `useQuery` wrapper. The `enabled` option is critical: the caller will pass `enabled: isExpanded` to prevent fetching history for all prospects on mount.

---

### Task 6: ProspectRow UI Updates

**File: `apps/frontend/src/features/prospects/components/ProspectRow.tsx`** — MODIFY:

#### New imports to add (merge into existing import block, Biome will sort):

```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
import { useProspectStageTransitions } from '../hooks/useProspectStageTransitions'
```

**Import ordering (Biome alphabetical):**
- `@/components/ui/select` → goes with other `@/components/ui/...` imports
- `@/features/settings/hooks/useFunnelStages` → goes with other `@/features/...` imports (cross-feature, established pattern)
- `../hooks/useProspectStageTransitions` → goes with other relative imports

#### New state inside `ProspectRow`:

```typescript
const [stageError, setStageError] = useState<string | null>(null)
```

#### New hooks inside `ProspectRow` (after existing `update`, `archive`, `restore` hooks):

```typescript
const { data: stagesData } = useFunnelStages()
const stages = stagesData?.data ?? []

const { data: transitionsData, isLoading: transitionsLoading } =
  useProspectStageTransitions(prospect.id, { enabled: isExpanded })
const transitions = transitionsData?.data ?? []
```

**Why `useFunnelStages()` in ProspectRow:** `ProspectsList` already calls this hook, so by the time any row is mounted, TanStack Query has cached the result. No additional API call is made. This is the established cross-feature import pattern from Story 3.4.

#### New handler inside `ProspectRow`:

```typescript
function handleStageChange(newStageId: string) {
  setStageError(null)
  update.mutate(
    { id: prospect.id, funnel_stage_id: newStageId },
    {
      onSuccess: () => {
        toast.success(t('prospects.toast.stageMoved'))
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.errors[0]?.message : undefined
        setStageError(message ?? t('prospects.toast.stageMoveFailed'))
      },
    },
  )
}
```

**Note:** `update` mutation is already declared (`const update = useUpdateProspect()`). Stage change and field edit both use `useUpdateProspect` — they're mutually exclusive in the UI (stage select only appears in read-only mode, edit form appears in edit mode).

#### Compute stage position (inside component, after hooks):

```typescript
const currentStageIndex = stages.findIndex((s) => s.id === prospect.funnelStageId)
const stagePosition = currentStageIndex >= 0 ? currentStageIndex + 1 : null
```

#### Read-only expanded panel — ADD stage select and history BEFORE the interactions placeholder:

Replace the section:
```tsx
{/* Interactions — Epic 5 */}
<p className="mt-4 text-xs italic text-muted-foreground">
  {t('prospects.interactionsComingSoon')}
</p>
```

With:
```tsx
{/* Stage management — active prospects only */}
{!isArchived && (
  <div className="mt-4 flex flex-col gap-1">
    <Label htmlFor={`stage-select-${prospect.id}`}>
      {t('prospects.fields.funnelStage')}
      {stagePosition !== null && stages.length > 0 && (
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {t('prospects.stagePosition', { current: stagePosition, total: stages.length })}
        </span>
      )}
    </Label>
    <Select
      value={prospect.funnelStageId}
      onValueChange={handleStageChange}
      disabled={update.isPending || stages.length === 0}
    >
      <SelectTrigger
        id={`stage-select-${prospect.id}`}
        className="w-full"
        aria-label={t('prospects.aria.stageSelect', { name: prospect.name })}
      >
        <SelectValue placeholder={t('prospects.fields.funnelStage')} />
      </SelectTrigger>
      <SelectContent>
        {stages.map((stage) => (
          <SelectItem key={stage.id} value={stage.id}>
            {stage.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {stageError && <p className="text-xs text-destructive">{stageError}</p>}
  </div>
)}

{/* Stage History (FR44) */}
<div className="mt-4">
  <p className="mb-1 text-xs font-medium text-muted-foreground">
    {t('prospects.stageHistory')}
  </p>
  {transitionsLoading ? (
    <p className="text-xs italic text-muted-foreground">...</p>
  ) : transitions.length === 0 ? (
    <p className="text-xs italic text-muted-foreground">
      {t('prospects.noStageHistory')}
    </p>
  ) : (
    <ul className="space-y-1">
      {transitions.map((tr) => (
        <li key={tr.id} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{new Date(tr.transitionedAt).toLocaleDateString()}</span>
          <span>—</span>
          <span>
            {tr.fromStageName ?? t('prospects.initialStage')}
            {' → '}
            {tr.toStageName}
          </span>
        </li>
      ))}
    </ul>
  )}
</div>

{/* Interactions — Epic 5 */}
<p className="mt-4 text-xs italic text-muted-foreground">
  {t('prospects.interactionsComingSoon')}
</p>
```

---

### Task 7: i18n Keys

**File: `apps/frontend/public/locales/en.json`** — ADD to `prospects` section:

```json
"stageHistory": "Stage History",
"noStageHistory": "No stage changes recorded yet.",
"initialStage": "Initial",
"stagePosition": "({{current}} of {{total}})",
"toast": {
  "stageMoved": "Prospect moved to new stage",
  "stageMoveFailed": "Failed to move prospect to new stage"
},
"fields": {
  "funnelStage": "Funnel Stage"
},
"aria": {
  "stageSelect": "Change funnel stage for {{name}}"
}
```

⚠️ **Merge with existing keys** — do NOT replace. Existing keys to keep:
- `toast.created`, `toast.updated`, `toast.archived`, `toast.restored`, `toast.createFailed`, `toast.updateFailed`, `toast.archiveFailed`, `toast.restoreFailed`
- `aria.editProspect`, `aria.cancelEdit`, `aria.archiveProspect`, `aria.restoreProspect`
- `fields.name`, `fields.company`, etc.

**File: `apps/frontend/public/locales/fr.json`** — ADD same keys translated:

```json
"stageHistory": "Historique des étapes",
"noStageHistory": "Aucun changement d'étape enregistré.",
"initialStage": "Début",
"stagePosition": "({{current}} sur {{total}})",
"toast": {
  "stageMoved": "Prospect déplacé vers une nouvelle étape",
  "stageMoveFailed": "Impossible de déplacer le prospect"
},
"fields": {
  "funnelStage": "Étape du funnel"
},
"aria": {
  "stageSelect": "Changer l'étape du funnel pour {{name}}"
}
```

---

### Project Structure Notes

**New files to create:**
- `apps/backend/database/migrations/0004_create_prospect_stage_transitions_table.ts`
- `apps/backend/app/models/prospect_stage_transition.ts`
- `apps/frontend/src/features/prospects/hooks/useProspectStageTransitions.ts`

**Existing files to modify:**
- `apps/backend/app/models/prospect.ts` — add `hasMany` import and relation
- `apps/backend/app/controllers/prospects_controller.ts` — add transition recording + new action
- `apps/backend/start/routes.ts` — add `GET /:id/stage-transitions` route
- `apps/backend/tests/functional/prospects/api.spec.ts` — add transition + history tests
- `apps/frontend/src/features/prospects/lib/api.ts` — `UpdateProspectPayload` fix + new type + method
- `apps/frontend/src/lib/queryKeys.ts` — add `stageTransitions(id)` key
- `apps/frontend/src/features/prospects/components/ProspectRow.tsx` — stage select + history UI
- `apps/frontend/public/locales/en.json` — new i18n keys
- `apps/frontend/public/locales/fr.json` — idem en français

**No new pages, no new routes needed** — all UI additions are within the existing `ProspectRow` expanded panel.

---

### CRITICAL: API Returns camelCase (Known Divergence)

Lucid v3 serializes camelCase by default. All API response fields are camelCase:
- `funnelStageId` (NOT `funnel_stage_id`) in prospect responses
- `transitionedAt` (NOT `transitioned_at`) in transition responses
- `fromStageId`, `toStageId`, `fromStageName`, `toStageName` (all camelCase)

The `StageTransitionType` type is already defined with camelCase fields above.

---

### CRITICAL: Biome Import Sort Order

Biome sorts imports alphabetically:
1. `@` scoped packages (`@/components/...`, `@/features/...`, `@/lib/...`)
2. Relative imports (`../hooks/...`, `./...`)

Cross-feature import pattern (established in Story 3.4):
```typescript
// Settings feature hook used in Prospects feature — allowed (cached query, no API overhead)
import { useFunnelStages } from '@/features/settings/hooks/useFunnelStages'
```

---

### CRITICAL: UpdateProspectPayload — No Frontend Validation Schema Change Needed

The frontend `updateProspectSchema` (VineJS) in `apps/frontend/src/features/prospects/schemas/prospect.ts` is only used for the **edit form** (name, company, email, etc.). The stage change is NOT part of the form — it's a direct `onChange` on a shadcn `Select` that fires a mutation without form validation. So `updateProspectSchema` does NOT need `funnel_stage_id`.

Only the TypeScript type `UpdateProspectPayload` needs the new field.

---

### Previous Story Intelligence (Story 3.5 Learnings)

**What was established:**
- Archive/restore pattern: `useArchiveProspect`, `useRestoreProspect` in `useProspectMutations.ts`
- `queryKeys.prospects.all = ['prospects']` — invalidating this clears ALL prospect queries
- Error pattern: `error instanceof ApiError ? error.errors[0]?.message : undefined` — then fallback to i18n key
- Success: `toast.success()` only — never `toast.error()` for mutations
- Inline errors in the expanded panel (not toasts) for mutation failures
- AlertDialog from `@/components/ui/alert-dialog` for destructive confirmations (not needed here — stage change is non-destructive)
- Switch component from `@/components/ui/switch` (installed in Story 3.5)

**What this story reuses:**
- `useUpdateProspect()` (already used in edit form) — reused for stage changes
- `useFunnelStages()` (cross-feature import, established in Story 3.4) — reused for stage list
- Same error handling pattern
- Same `queryKeys.prospects.all` invalidation via `useUpdateProspect` `onSuccess`

---

### Git Intelligence Summary

Recent commits (last 5):
- `58a16f9` Merge PR #16 — story 3.5 (archive/restore functionality)
- `8bf44f5` feat(prospects): finalize archive and restore functionality with UI updates and tests
- `0306b29` feat(prospects): implement archive and restore functionality for prospects
- `46e7e89` refactor(prospectRow): add animation to Chevron icon
- `b6cf83c` Merge PR #15 — story 3.4 (prospect create/edit)

**Patterns from recent work:**
1. `ProspectRow` mutation pattern: declare hook → handler function → `mutation.mutate(id, { onSuccess, onError })`
2. Inline errors: `useState<string | null>(null)` + `<p className="text-xs text-destructive">{error}</p>`
3. Controller test pattern: `registerUser(client, uniquePrefix)` + `getFirstStage(userId)` helpers
4. Biome auto-formats on `pnpm biome check --write .` — run this last

---

### References

- [Source: apps/backend/app/controllers/prospects_controller.ts] — existing `update()` action (add transition recording on top)
- [Source: apps/backend/app/models/prospect.ts] — model to extend with `hasMany` relation
- [Source: apps/backend/database/migrations/0003_create_prospects_table.ts] — FK pattern to follow
- [Source: apps/backend/start/routes.ts] — existing prospects routes group structure
- [Source: apps/backend/tests/functional/prospects/api.spec.ts] — `registerUser`, `getFirstStage` helpers
- [Source: apps/frontend/src/features/prospects/lib/api.ts] — `UpdateProspectPayload` type to extend
- [Source: apps/frontend/src/features/prospects/hooks/useProspectMutations.ts] — `useUpdateProspect` hook
- [Source: apps/frontend/src/features/prospects/components/ProspectRow.tsx] — component to modify
- [Source: apps/frontend/src/features/settings/hooks/useFunnelStages.ts] — cross-feature import
- [Source: apps/frontend/src/lib/queryKeys.ts] — query keys to extend
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6] — original acceptance criteria (FR43, FR44)
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Patterns] — soft delete, forUser scope, M1 security

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
