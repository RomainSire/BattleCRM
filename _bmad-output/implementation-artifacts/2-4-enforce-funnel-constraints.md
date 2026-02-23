# Story 2.4: Enforce Funnel Constraints

Status: review

<!-- Ultimate Context Engine Analysis: 2026-02-23 -->
<!-- Previous story: 2-3-build-funnel-configuration-ui (done) -->

## Story

As a **system**,
I want to enforce funnel configuration rules,
So that users cannot create invalid funnel configurations.

## Acceptance Criteria

1. **AC1 (Max 15 stages):** When a user already has 15 active funnel stages and tries to add another, the API returns a 422 error with message "Maximum 15 stages allowed", and the frontend shows the error inline. Additionally, the UI proactively shows the current stage count (X/15) and replaces the "Add Stage" form with a "Maximum reached" message when the limit is hit (FR40).
2. **AC2 (Linear ordering):** The system only allows linear ordering — no branching or parallel paths. This is enforced by the `(user_id, position) WHERE deleted_at IS NULL` unique index on the database (prevents two stages at the same position). No additional code needed; verified by existing tests.
3. **AC3 (Sequential positions — no gaps):** After any delete or reorder operation, position values are always sequential (1, 2, 3… no gaps). Already implemented in Stories 2.2's `destroy()` and `reorder()` controller methods. No additional code needed; verified by existing functional tests.
4. **AC4 (Prospects warning — DEFERRED):** When deleting a stage that has prospects assigned, show a warning with the count of affected prospects. **DEFERRED to Epic 3** — the prospects table does not exist yet. The existing `AlertDialog` confirmation from Story 2.3 already satisfies the "must confirm" requirement. The "show how many prospects are affected" part will be implemented in Epic 3 when the prospects table is created.
5. **AC5 (Lint + tests):** `pnpm lint` from root passes with 0 errors; existing functional tests and new max-stages test pass.

## Tasks / Subtasks

- [x] **Task 1: Backend — Enforce max 15 stages in controller** (AC1)
  - [x] 1.1 In `funnel_stages_controller.ts` `store()` method, before the transaction, query active stage count for user and return 422 if count >= 15
  - [x] 1.2 Error response format: `{ errors: [{ message: 'Maximum 15 stages allowed', rule: 'maxStages', field: 'name' }] }` (Adonis standard format)

- [x] **Task 2: Backend — Add functional test for max 15** (AC1, AC5)
  - [x] 2.1 In `tests/functional/funnel_stages/api.spec.ts`, add test: `POST /api/funnel_stages returns 422 when user has 15 active stages`
  - [x] 2.2 Test setup: register user (gets 10 default stages), add 5 more via API, then assert the 16th fails with 422

- [x] **Task 3: Frontend — Show stage count and enforce max limit** (AC1)
  - [x] 3.1 Add i18n keys `funnelStages.stageCount` and `funnelStages.maxReached` to `en.json` and `fr.json`
  - [x] 3.2 In `FunnelStageList.tsx`: derive `isAtMax = localStages.length >= 15`
  - [x] 3.3 Replace `<AddStageForm />` with max-reached message when `isAtMax`; always show `{localStages.length}/15` count below the list
  - [x] 3.4 No change needed to `AddStageForm.tsx` — the 422 error already shows inline via `setApiError` (from Story 2.3 review fix)

- [x] **Task 4: Verification** (AC5)
  - [x] 4.1 `pnpm lint` from root → 0 errors
  - [x] 4.2 `pnpm --filter @battlecrm/frontend type-check` → 0 errors
  - [ ] 4.3 `ENV_PATH=../../ node ace test functional` → all pass (requires running DB)

---

## Dev Notes

### CRITICAL: What is already implemented (DO NOT re-implement)

**AC2 and AC3 are FULLY DONE in Stories 2.1–2.2. Do not touch these mechanisms:**

| Constraint | Where enforced | Status |
|------------|----------------|--------|
| Unique positions per user (no branching) | `CREATE UNIQUE INDEX idx_funnel_stages_user_position_active ON funnel_stages (user_id, position) WHERE deleted_at IS NULL` | ✅ Done (migration 0002) |
| Sequential positions after delete | `destroy()` in `FunnelStagesController` — two-step renumber | ✅ Done (Story 2.2) |
| Sequential positions after reorder | `reorder()` in `FunnelStagesController` — two-step assign | ✅ Done (Story 2.2) |
| Functional tests for sequential positions | `DELETE /api/funnel_stages/:id renumbers remaining positions sequentially` | ✅ Done (api.spec.ts) |

**AC4 is DEFERRED:**
- Requires prospects table (Epic 3, Story 3.1)
- Current delete confirmation (`AlertDialog` from Story 2.3) already satisfies "must confirm"
- When implementing Epic 3, add `prospectCount` to stage responses or add a dedicated endpoint

---

### CRITICAL: Task 1 — Backend max 15 implementation

**File:** `apps/backend/app/controllers/funnel_stages_controller.ts`

Add the count check in `store()` BEFORE the transaction:

```typescript
async store({ request, response, auth }: HttpContext) {
  const { name } = await request.validateUsing(createFunnelStageValidator)
  const userId = auth.user!.id

  // Enforce FR40: maximum 15 active stages per user
  // Note: pre-transaction check is acceptable for MVP single-user CRM.
  // Concurrent race at exactly 14 stages is negligible risk.
  const activeStages = await FunnelStage.query()
    .withScopes((s) => s.forUser(userId))
    .select('id')

  if (activeStages.length >= 15) {
    return response.unprocessableEntity({
      errors: [{ message: 'Maximum 15 stages allowed', rule: 'maxStages', field: 'name' }],
    })
  }

  // Existing transaction code unchanged below...
  const stage = await db.transaction(async (trx) => {
    // ... existing code unchanged
  })

  return response.created(stage)
}
```

**Why pre-transaction check is used (not inside transaction):**
- Cannot return HTTP response from inside `db.transaction()` callback
- Must throw an exception and catch outside if done inside — adds complexity
- For a single-user personal CRM MVP, concurrent creation at exactly 14 stages is negligible
- If needed in future: throw custom error inside transaction, catch + convert to HTTP response outside

---

### CRITICAL: Task 2 — Functional test for max 15

**File:** `apps/backend/tests/functional/funnel_stages/api.spec.ts`

Add this test in the `POST /api/funnel_stages` section (after the empty string test):

```typescript
test('POST /api/funnel_stages returns 422 when user has 15 active stages', async ({ client }) => {
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

  // Attempt to add a 16th stage — must be rejected
  const response = await client
    .post('/api/funnel_stages')
    .loginAs(user)
    .json({ name: 'Over The Limit Stage' })

  response.assertStatus(422)
})
```

---

### CRITICAL: Task 3 — Frontend changes

#### 3.1 — i18n keys

**File:** `apps/frontend/public/locales/en.json`

Add to the `funnelStages` object:
```json
"stageCount": "{{count}}/15 stages",
"maxReached": "Maximum of 15 stages reached. Archive a stage to add more."
```

**File:** `apps/frontend/public/locales/fr.json`

Add to the `funnelStages` object:
```json
"stageCount": "{{count}}/15 étapes",
"maxReached": "Maximum de 15 étapes atteint. Archivez une étape pour en ajouter."
```

#### 3.2–3.3 — FunnelStageList.tsx

**File:** `apps/frontend/src/features/settings/components/FunnelStageList.tsx`

Derive `isAtMax` from `localStages.length` and conditionally render:

```typescript
const isAtMax = localStages.length >= 15

// Replace the existing AddStageForm section (the `<div className="pt-1">` block)
// with this:
<div className="pt-1 space-y-1">
  {isAtMax ? (
    <p className="text-sm text-muted-foreground">{t('funnelStages.maxReached')}</p>
  ) : (
    <AddStageForm />
  )}
  <p className="text-right text-xs text-muted-foreground">
    {t('funnelStages.stageCount', { count: localStages.length })}
  </p>
</div>
```

**No changes to `AddStageForm.tsx`** — if somehow the form is still shown with 15 stages (e.g., race condition), the 422 error from the backend will display inline via `setApiError` (implemented in Story 2.3's code review).

---

### Architecture Compliance

| Requirement | Implementation |
|-------------|----------------|
| FR40: Max 15 stages | Backend 422 check in `store()` + frontend count + disable form |
| FR42: Linear order | Enforced by unique partial DB index (no code change) |
| VineJS validation | Existing validators unchanged; max-15 is a business rule in controller, not VineJS |
| Error format | Adonis standard `{ errors: [{ message, rule, field }] }` |
| Inline error display | `setApiError` in `AddStageForm` (from Story 2.3 review) handles 422 automatically |
| Soft delete | No change — existing `destroy()` handles soft delete + renumber |
| User isolation | `forUser()` scope used in new count query |
| Transactions | Count check is pre-transaction (acceptable tradeoff — see note above) |
| Sequential positions | Already verified, no change |
| TypeScript | No `any` types; use `string[]` for IDs |
| Biome | Run `pnpm biome check --write .` from root before commit |

---

### AC4 Deferral — Implementation Path for Epic 3

When Story 3.1 creates the prospects table, Story 3.x (or a new story) should:

1. **Backend:** Add `prospectCount` to funnel stage responses:
   ```typescript
   // In index() and potentially a new GET /api/funnel_stages/:id endpoint
   // Count prospects WHERE funnel_stage_id = stage.id AND deleted_at IS NULL
   ```

2. **Frontend:** Enhance `FunnelStageItem.tsx` delete dialog:
   ```typescript
   // In AlertDialogDescription:
   // If prospectCount > 0: "X prospects are currently at this stage and will become unassigned."
   // If prospectCount === 0: existing message
   ```

3. **No sprint-status update needed** — this is documented as a known future enhancement.

---

### Previous Story Intelligence (Story 2.3 — done)

**Key patterns established:**
- Errors from API mutations display inline via `setApiError` / `setUpdateError` / `setDeleteError` states — do NOT use `toast.error()` for API errors
- `FunnelStageItem` receives `displayPosition={index + 1}` prop from list (not `stage.position`)
- All toast calls are success-only: `toast.success(t(...))`
- `funnelStageSchema` in `apps/frontend/src/features/settings/schemas/funnelStage.ts` is reusable
- `i18nMessagesProvider` from `@/lib/validation` used with VineJS resolver

**Completed infrastructure (DO NOT recreate):**
- `apps/frontend/src/features/settings/lib/api.ts` — `funnelStagesApi` with all 5 methods
- `apps/frontend/src/features/settings/hooks/useFunnelStages.ts` — all mutation hooks
- `apps/frontend/src/features/settings/components/FunnelStageList.tsx` — DnD list (to modify for AC1)
- `apps/frontend/src/features/settings/components/FunnelStageItem.tsx` — item with edit/delete/drag
- `apps/frontend/src/features/settings/components/AddStageForm.tsx` — add form with inline error
- `apps/frontend/src/features/settings/SettingsPage.tsx` — settings page
- `apps/frontend/src/components/common/AppNavbar.tsx` — navbar
- `tests/e2e/settings-funnel.spec.ts` — E2E tests

**Story 2.3 debug learnings:**
- `sonner.tsx` used `useTheme` from `next-themes` (shadcn template default) — already fixed to `@/lib/theme`
- TanStack Query `onError` types `error` as `Error` by default — use `instanceof ApiError` guard
- Biome `noArrayIndexKey` rule — use string keys for skeleton loaders, not array index

---

### Git Intelligence

**Recent commits:**
- `78857b3` Merge pull request #10 from RomainSire/story-2.3
- `30a119d` feat(funnel): finalize funnel config after code review
- `57d8e0e` fix(funnel): replace 'any' type with 'StageDto' for better type safety in API tests

**Expected branch naming:** `story-2-4`
**Expected commit format:** `feat(funnel): enforce max 15 stages constraint`

**Pattern from previous stories:**
- Single meaningful commit for the feature
- `feat(funnel):` prefix for Epic 2 work

---

### Project Structure Notes

**Files to MODIFY:**

```
apps/backend/
├── app/controllers/funnel_stages_controller.ts   # ADD max 15 check in store()
└── tests/functional/funnel_stages/api.spec.ts    # ADD max-stages test

apps/frontend/src/
├── features/settings/components/FunnelStageList.tsx  # ADD isAtMax + count display
└── public/locales/
    ├── en.json                                       # ADD stageCount + maxReached keys
    └── fr.json                                       # ADD same keys in French
```

**No new files need to be created for this story.**

---

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4: Enforce Funnel Constraints]
- [Source: _bmad-output/planning-artifacts/epics.md#FR40, FR42]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data & Validation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Patterns — Error Handling]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns — Error Feedback]
- [Source: apps/backend/app/controllers/funnel_stages_controller.ts — existing store() implementation]
- [Source: apps/backend/tests/functional/funnel_stages/api.spec.ts — existing test patterns]
- [Source: apps/backend/app/validators/funnel_stages.ts — existing validators]
- [Source: apps/backend/database/migrations/0002_create_funnel_stages_table.ts — unique index]
- [Source: apps/frontend/src/features/settings/components/FunnelStageList.tsx — to modify]
- [Source: apps/frontend/src/features/settings/components/AddStageForm.tsx — inline error pattern]
- [Source: _bmad-output/project-context.md — anti-patterns to avoid]
- [Source: _bmad-output/implementation-artifacts/2-3-build-funnel-configuration-ui.md#Dev Notes — previous story learnings]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Biome formatter required multi-line chaining for `.query().withScopes().select()` — fixed by splitting onto separate lines

### Completion Notes List

- AC1 enforced via pre-transaction count check in `store()` — returns `422 Unprocessable Entity` with `{ errors: [{ message: 'Maximum 15 stages allowed', rule: 'maxStages', field: 'name' }] }`
- AC2 and AC3 confirmed already implemented and tested (Story 2.1/2.2) — no code changes required
- AC4 deferred to Epic 3 (requires prospects table); `AlertDialog` from Story 2.3 already satisfies "must confirm"
- Frontend: `FunnelStageList` shows `X/15 stages` counter always; when count >= 15 replaces `AddStageForm` with max-reached message
- Inline API error for 422 (if backend check somehow bypassed) handled automatically by `setApiError` from Story 2.3 review fix

### File List

**Modified:**
- `apps/backend/app/controllers/funnel_stages_controller.ts` — added max 15 count check in `store()`
- `apps/backend/tests/functional/funnel_stages/api.spec.ts` — added max-stages 422 test
- `apps/frontend/src/features/settings/components/FunnelStageList.tsx` — added `isAtMax` guard + `stageCount` display
- `apps/frontend/public/locales/en.json` — added `stageCount` and `maxReached` keys
- `apps/frontend/public/locales/fr.json` — added `stageCount` and `maxReached` keys
