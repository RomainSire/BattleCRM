# Story 1.7: Implement User Logout

Status: review

<!-- Ultimate Context Engine Analysis: 2026-02-18 -->
<!-- Previous stories: 1-1 (done), 1-2 (done), 1-3 (done), 1-4 (done), 1-5 (done), 1-6 (done) -->

## Story

As a **logged-in user**,
I want **to log out of BattleCRM**,
So that **my session is securely terminated**.

## Acceptance Criteria

1. **AC1:** Given I am logged in, when I click the logout button in the navigation, then my session is destroyed on the server and my session cookie is cleared and I am redirected to the login page (FR53)
2. **AC2:** Given I have logged out, when I try to access a protected page directly, then I am redirected to the login page
3. **AC3:** Given I have logged out, when I press the browser back button, then I cannot access protected content without logging in again

## Tasks / Subtasks

- [x] **Task 1: Add Logout Loading State** (AC: 1)
  - [x] 1.1 Add `dashboard.loggingOut` translation key to `public/locales/en.json`: "Logging out..."
  - [x] 1.2 Add `dashboard.loggingOut` translation key to `public/locales/fr.json`: "Déconnexion en cours..."
  - [x] 1.3 Update `DashboardPage.tsx` logout button to show loading text: `{logout.isPending ? t('dashboard.loggingOut') : t('dashboard.logout')}`

- [x] **Task 2: Backend Functional Tests** (AC: 1, 2, 3)
  - [x] 2.1 Create `tests/functional/auth/logout.spec.ts`:
    - Test: POST /api/auth/logout with valid session → 200, session destroyed
    - Test: POST /api/auth/logout without session → 401 (auth middleware blocks)
    - Test: GET /api/auth/me without session → 401 (protected route guard)

## Dev Notes

### Critical Architecture Requirements

**MUST USE these exact technologies — NO substitutions:**

| Technology | Choice | Notes |
|-----------|--------|-------|
| Auth | AdonisJS session auth (scrypt) | Already configured. NOT Supabase Auth SDK |
| Session | httpOnly cookies (`battlecrm_session`) | `clearWithBrowser: false`, `age: 2h`, `sameSite: lax` |
| State management | TanStack Query | For all server state (auth status) |
| UI components | shadcn/ui (Button) | Already installed |
| i18n | i18next + react-i18next | Already configured |
| Linting | Biome v2 | Root `biome.json`, NOT ESLint/Prettier |

### CRITICAL: Existing Logout Implementation

**Most of the logout flow is already implemented from Story 1.5 code review.** This story is primarily about adding tests, loading state, and verifying the complete flow works end-to-end.

**Backend — ALREADY EXISTS, DO NOT MODIFY:**
```typescript
// apps/backend/app/controllers/auth_controller.ts
async logout({ auth, response }: HttpContext) {
  await auth.use('web').logout()
  return response.ok({ message: 'Logged out' })
}

// apps/backend/start/routes.ts
router.post('/logout', [AuthController, 'logout']).use(middleware.auth())
```

**Frontend — ALREADY EXISTS, DO NOT MODIFY (except DashboardPage loading text):**
```typescript
// apps/frontend/src/features/auth/lib/api.ts
logout() {
  return fetchApi<{ message: string }>('/auth/logout', { method: 'POST' })
}

// apps/frontend/src/features/auth/hooks/useAuth.ts
export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.all })
    },
  })
}
```

**Bruno API file — ALREADY EXISTS:**
- `.brunoCollection/auth/Logout.bru` — already created in Story 1.5

### CRITICAL: Logout Flow (Already Working)

```
Frontend                           Backend
────────                           ───────
1. User clicks "Log out" button
   → POST /api/auth/logout

2. Backend: auth.use('web').logout()
   (destroys session in DB/store)
   ← 200 { message: 'Logged out' }

3. Frontend: queryClient.invalidateQueries({ queryKey: queryKeys.auth.all })
   → useCurrentUser() refetches → GET /api/auth/me
   ← 401 (no session)
   → AuthGuard detects no user → Navigate to /login
```

**AC2 & AC3 are handled by AuthGuard:**
- `AuthGuard` checks `useCurrentUser()` on every render
- If user is not authenticated, it redirects to `/login`
- After logout, the query cache is cleared → `useCurrentUser()` returns error → AuthGuard redirects
- Browser back button triggers AuthGuard re-evaluation → still no user → stays on `/login`

### Files to MODIFY

```
apps/frontend/
├── src/features/dashboard/DashboardPage.tsx   # ADD: loading text on logout button
├── public/locales/en.json                     # ADD: dashboard.loggingOut
├── public/locales/fr.json                     # ADD: dashboard.loggingOut
```

### Files to CREATE

```
apps/backend/
├── tests/functional/auth/
│   └── logout.spec.ts                         # NEW: 3-4 test cases
```

### Files NOT to modify

- `app/controllers/auth_controller.ts` — logout method already exists
- `start/routes.ts` — logout route already exists
- `src/features/auth/hooks/useAuth.ts` — useLogout hook already exists
- `src/features/auth/lib/api.ts` — logout API method already exists
- `src/features/auth/components/AuthGuard.tsx` — already handles redirect
- `.brunoCollection/auth/Logout.bru` — already exists

### Previous Story Intelligence

**Story 1.6 (User Login) — Key Learnings:**
- Backend error handling: catch specific error types, re-throw others (review fix from 1.6)
- Tests use unique email domains (e.g., `@test-login.com`) with teardown cleanup
- `loginAs(user)` helper from `@japa/api-client` establishes test sessions — essential for logout tests
- `ENV_PATH=../../` prefix required for all `node ace` commands
- Biome sorts imports alphabetically — `@` scoped packages before `#` aliases
- `assertCookieMissing('battlecrm_session')` does NOT work for session cookies — AdonisJS sets the cookie on every request (the session exists but is empty after logout)

**Story 1.5 Code Review — Logout was added here:**
- `logout` endpoint and `useLogout` hook were added during Story 1.5 code review
- No tests were written at that time

### Naming Conventions (CRITICAL)

| Element | Convention | Example |
|---------|------------|---------|
| Test file | snake_case | `logout.spec.ts` |

### Anti-Patterns to AVOID

- **DO NOT** create new backend endpoint or route — they already exist
- **DO NOT** create new frontend hook or API method — they already exist
- **DO NOT** create a new Bruno file — it already exists
- **DO NOT** use `assertCookieMissing('battlecrm_session')` — AdonisJS always sets session cookie
- **DO NOT** add explicit `navigate('/login')` after logout — AuthGuard cascade handles this correctly

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback Patterns]
- [Source: _bmad-output/project-context.md#Authentication]
- [Source: _bmad-output/implementation-artifacts/1-6-implement-user-login.md]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

No issues encountered during implementation.

### Completion Notes List

- Added loading state text on logout button ("Logging out..." / "Déconnexion en cours...")
- Created 3 functional tests for logout endpoint (authenticated logout, unauthenticated attempt, protected route guard)
- All 17 backend tests pass (0 regressions), TypeScript compiles clean, Biome passes
- Backend logout endpoint, route, frontend API, hook, and Bruno file were all pre-existing from Story 1.5 code review

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-18 | Story created with ultimate context analysis (logout: tests + loading state, most code already exists) | SM Agent (Opus 4.6) |
| 2026-02-18 | Full story implementation: logout loading state + i18n keys + 3 functional tests | Dev Agent (Opus 4.6) |

### File List

- `apps/frontend/src/features/dashboard/DashboardPage.tsx` — MODIFIED: added loading text on logout button
- `apps/frontend/public/locales/en.json` — MODIFIED: added `dashboard.loggingOut`
- `apps/frontend/public/locales/fr.json` — MODIFIED: added `dashboard.loggingOut`
- `apps/backend/tests/functional/auth/logout.spec.ts` — NEW: 3 functional tests for logout endpoint
