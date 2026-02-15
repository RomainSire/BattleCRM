# Story 1.6: Implement User Login

Status: ready-for-dev

<!-- Ultimate Context Engine Analysis: 2026-02-15 -->
<!-- Previous stories: 1-1 (done), 1-2 (done), 1-3 (done), 1-4 (done), 1-5 (done) -->

## Story

As a **registered user**,
I want **to log in with my email and password**,
So that **I can access my BattleCRM data securely**.

## Acceptance Criteria

1. **AC1:** Given I am on the login page, when I enter valid credentials, then a session is created with an httpOnly secure cookie and I am redirected to the dashboard (FR52)
2. **AC2:** Given I enter invalid credentials, when I submit the login form, then I see an error "Invalid email or password" and no session is created
3. **AC3:** Given I am already logged in, when I navigate to the login page, then I am automatically redirected to the dashboard
4. **AC4:** Given my session cookie exists, when I refresh the page or return later, then I remain logged in without re-entering credentials
5. **AC5:** Given I enter an invalid email format, when I submit the login form, then I see an inline error under the email field and the form is not submitted (frontend validation)
6. **AC6:** Given I leave email or password empty, when I submit the login form, then I see inline errors under the empty fields (frontend validation)
7. **AC7:** The login page includes a link to the registration page (if registration is allowed)

## Tasks / Subtasks

- [ ] **Task 1: Create Login API Endpoint** (AC: 1, 2)
  - [ ] 1.1 Add `loginValidator` to `app/validators/auth.ts` with VineJS schema: `email` (required, valid email, trim, lowercase), `password` (required, string)
  - [ ] 1.2 Add `login` method to `app/controllers/auth_controller.ts`:
    - Validate request with `loginValidator`
    - Call `User.verifyCredentials(data.email, data.password)` (from AuthFinder mixin)
    - Catch `E_INVALID_CREDENTIALS` exception → return 400 with `{ errors: [{ message: "auth.login.invalidCredentials" }] }`
    - On success: `await auth.use('web').login(user)`
    - Return 200 with `{ user: { id, email } }`

- [ ] **Task 2: Add Login Route** (AC: 1, 3)
  - [ ] 2.1 Add `router.post('/login', [AuthController, 'login']).use(middleware.guest())` in the auth route group in `start/routes.ts`

- [ ] **Task 3: Add Frontend Login API Method** (AC: 1, 2)
  - [ ] 3.1 Add `login(email: string, password: string)` method to `authApi` in `src/features/auth/lib/api.ts`
  - [ ] 3.2 Method calls `POST /auth/login` with `{ email, password }` body, returns `{ user: { id, email } }`

- [ ] **Task 4: Create Login Hook** (AC: 1, 2)
  - [ ] 4.1 Add `useLogin()` mutation hook in `src/features/auth/hooks/useAuth.ts`
  - [ ] 4.2 On success: `queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })` to trigger auth state refresh

- [ ] **Task 5: Create Login Schema** (AC: 5, 6)
  - [ ] 5.1 Create `src/features/auth/schemas/login.ts` with VineJS schema: `email` (required, valid email, trim, lowercase), `password` (required, string — no minLength on login, only on register)

- [ ] **Task 6: Implement Login Form in LoginPage** (AC: 1, 2, 5, 6, 7)
  - [ ] 6.1 Refactor `src/features/auth/LoginPage.tsx` from placeholder to working form:
    - Use `react-hook-form` with `useForm()` and `@hookform/resolvers/vine` for VineJS validation
    - Use `TextField` component for email field (same pattern as RegisterPage)
    - Use `PasswordInput` wrapped in `Field` for password field (same pattern as RegisterPage)
    - Submit button with loading state (disabled + "Signing in..." text during mutation)
  - [ ] 6.2 On form submit: call `useLogin()` mutation with `{ email, password }`
  - [ ] 6.3 On success: navigate to `/` (dashboard) — TanStack Query auth invalidation triggers AuthGuard refresh
  - [ ] 6.4 On error: display server error message above the form (translated via `i18next.t()`) — NOT as field-level error since "Invalid email or password" applies to both fields
  - [ ] 6.5 Keep conditional link to register page (already exists, uses `useRegistrationStatus`)
  - [ ] 6.6 Add link to register page: "Don't have an account? Create one" (already partially done)

- [ ] **Task 7: Add i18n Translation Keys** (AC: 1, 2, 5, 6)
  - [ ] 7.1 Add to `public/locales/en.json`:
    - `auth.login.submit`: "Sign In" (already exists)
    - `auth.login.submitting`: "Signing in..."
    - `auth.login.invalidCredentials`: "Invalid email or password"
  - [ ] 7.2 Add to `public/locales/fr.json`:
    - `auth.login.submitting`: "Connexion en cours..."
    - `auth.login.invalidCredentials`: "Email ou mot de passe invalide"

- [ ] **Task 8: Backend Tests** (AC: 1, 2, 3)
  - [ ] 8.1 Create `tests/functional/auth/login.spec.ts`:
    - Test: POST /api/auth/login with valid credentials → 200, user data, session cookie set
    - Test: POST /api/auth/login with wrong password → 400 with error message
    - Test: POST /api/auth/login with non-existent email → 400 with error message (same error as wrong password for security)
    - Test: POST /api/auth/login with invalid email format → 422 validation error
    - Test: POST /api/auth/login with missing fields → 422 validation error
    - Test: POST /api/auth/login when already logged in → redirect (guest middleware)
  - [ ] 8.2 Each test creates/deletes its own test user with `@test-login.com` email domain and teardown cleanup

- [ ] **Task 9: Add Bruno API File** (AC: 1)
  - [ ] 9.1 Create `.brunoCollection/auth/Login.bru` with `POST /api/auth/login` endpoint definition

## Dev Notes

### Critical Architecture Requirements

**MUST USE these exact technologies — NO substitutions:**

| Technology | Choice | Notes |
|-----------|--------|-------|
| Auth | AdonisJS session auth (scrypt) | Already configured. NOT Supabase Auth SDK |
| Session | httpOnly cookies (`battlecrm_session`) | `clearWithBrowser: false`, `age: 2h`, `sameSite: lax` |
| Validation (backend) | VineJS (AdonisJS built-in) | Validators in `app/validators/` |
| Validation (frontend) | VineJS + react-hook-form | `@hookform/resolvers/vine` bridges VineJS schemas with react-hook-form |
| Form management | react-hook-form | `useForm()` for state, validation, submission handling |
| State management | TanStack Query | For all server state (auth status) |
| UI components | shadcn/ui (Card, Input, Button, Field, TextField, PasswordInput) | Already installed |
| Routing | React Router v7 | Already configured with guards |
| Layouts | GuestLayout | Login page wraps in GuestLayout with theme/language switchers |
| i18n | i18next + react-i18next | Already configured with http backend loader |
| Linting | Biome v2 | Root `biome.json`, NOT ESLint/Prettier |
| API error format | i18n translation keys | Custom exception handler converts errors to translation keys |

### CRITICAL: Login Flow

```
Frontend                           Backend
────────                           ───────
1. User fills login form
   → POST /api/auth/login
     { email, password }

2. Backend validates (VineJS loginValidator)
   Backend calls User.verifyCredentials(email, password)
   → If invalid: throw E_INVALID_CREDENTIALS
   → Catch: return 400 { errors: [{ message: "auth.login.invalidCredentials" }] }

3. If valid: auth.use('web').login(user)
   ← 200 { user: { id, email } }
     Set-Cookie: battlecrm_session=...

4. Frontend invalidates auth queries
   → GET /api/auth/me (auto-refetch)
   ← { id, email }
   → AuthGuard/GuestGuard re-evaluate
   → Navigate to / (dashboard)
```

### CRITICAL: AuthFinder `verifyCredentials` Pattern

The `User` model uses the `AuthFinder` mixin which provides `User.verifyCredentials(uid, password)`:
- Takes email (configured as UID) and password
- Finds user by email, verifies password against scrypt hash
- Throws `E_INVALID_CREDENTIALS` if user not found OR password doesn't match
- Returns the verified user if credentials are valid

```typescript
import User from '#models/user'

// In auth_controller.ts login method:
const user = await User.verifyCredentials(data.email, data.password)
await auth.use('web').login(user)
```

The `E_INVALID_CREDENTIALS` error comes from `@adonisjs/auth/build/src/errors.js`. Import it as:
```typescript
import { errors as authErrors } from '@adonisjs/auth'
// Then catch: authErrors.E_INVALID_CREDENTIALS
```

### CRITICAL: Error Handling Pattern

**Login errors are different from registration errors:**
- Registration: field-level errors (email invalid, password too short, email taken)
- Login: single form-level error ("Invalid email or password") — do NOT reveal whether the email exists or the password is wrong (security best practice)

**Frontend display:**
- VineJS validation errors → inline under fields (same as RegisterPage)
- Server-side "invalid credentials" → displayed as alert/banner above form, NOT under a specific field
- Use `translateError()` from `src/lib/api.ts` to translate the i18n key from the server response

### CRITICAL: Guest Middleware Behavior

The `guest` middleware on the login route handles AC3 (redirect if already logged in). However, note that for API routes, the guest middleware returns a **redirect response** (302) not a JSON error. The frontend `GuestGuard` component already handles this at the React level (redirects to `/` if `useCurrentUser()` returns data), so AC3 is covered by both layers.

### Frontend LoginPage Pattern

Follow the same pattern as `RegisterPage.tsx`:

```typescript
// Key imports needed:
import { useForm } from 'react-hook-form'
import { vineResolver } from '@hookform/resolvers/vine'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { loginSchema } from './schemas/login'
import { useLogin, useRegistrationStatus } from './hooks/useAuth'
import { translateError } from '@/lib/api'
// shadcn/ui components: Card, CardHeader, CardContent, CardTitle, CardDescription, Button
// Custom components: TextField, PasswordInput, Field, FieldError
```

### Login Schema — No minLength on Password

The login VineJS schema should NOT have `minLength(8)` on the password field. Only the register schema enforces password strength. Login just requires a non-empty string — let the backend handle credential verification.

```typescript
// src/features/auth/schemas/login.ts
import vine from '@vinejs/vine'

export const loginSchema = vine.compile(
  vine.object({
    email: vine.string().email().trim().toLowerCase(),
    password: vine.string(), // No minLength for login!
  }),
)
```

### Project Structure Notes

**Files to CREATE:**
```
apps/backend/
├── tests/functional/auth/
│   └── login.spec.ts               # NEW: 6 test cases

apps/frontend/
├── src/features/auth/
│   └── schemas/
│       └── login.ts                 # NEW: VineJS loginSchema

.brunoCollection/auth/
└── Login.bru                        # NEW: Bruno API file
```

**Files to MODIFY:**
```
apps/backend/
├── app/controllers/auth_controller.ts   # ADD: login method
├── app/validators/auth.ts               # ADD: loginValidator
├── start/routes.ts                      # ADD: POST /login route

apps/frontend/
├── src/features/auth/LoginPage.tsx      # REFACTOR: placeholder → working form
├── src/features/auth/hooks/useAuth.ts   # ADD: useLogin hook
├── src/features/auth/lib/api.ts         # ADD: login API method
├── public/locales/en.json               # ADD: login translation keys
├── public/locales/fr.json               # ADD: login translation keys
```

**Files NOT to modify:**
- `config/auth.ts` — session guard already configured
- `config/session.ts` — cookie session already configured
- `config/cors.ts` — credentials already enabled
- `app/models/user.ts` — AuthFinder mixin already provides verifyCredentials
- `src/routes.tsx` — `/login` route already exists with GuestGuard
- `src/lib/api.ts` — fetchApi wrapper already handles credentials
- `src/lib/queryKeys.ts` — auth query keys already exist
- `src/features/auth/components/AuthGuard.tsx` — already works
- `src/features/auth/components/GuestGuard.tsx` — already handles redirect
- `src/features/auth/RegisterPage.tsx` — no changes needed

### Previous Story Intelligence

**Story 1.5 (User Registration) — Key Learnings:**
- Custom exception handler in `app/exceptions/handler.ts` converts VineJS errors to i18n translation keys
- `translateError()` in `src/lib/api.ts` resolves translation keys via `i18next.t()`
- `TextField` component wraps react-hook-form `Controller` with shadcn Input
- `PasswordInput` component has show/hide toggle with proper ARIA
- `Field`, `FieldLabel`, `FieldError` components provide consistent form field layout
- Tests use unique email domains (e.g., `@test-register.com`) with teardown cleanup
- `loginAs(user)` helper from `@japa/api-client` establishes test sessions
- `ENV_PATH=../../` prefix required for all `node ace` commands
- Biome sorts imports alphabetically — `@` scoped packages come before `#` aliases

**Story 1.5 Code Review — Key Fixes Applied:**
- `logout` endpoint and hook were added during code review
- Dead code removed from `me` controller method
- VineJS schema file renamed from `registerValidator.ts` to `register.ts`
- `'use client'` directive removed (not needed in Vite apps)
- Error format docs updated to reflect i18n translation keys

### Git Intelligence

**Recent commits (last 5 on `story-1-5` branch):**
- `9809486` fix(docker): ensure postgres service restarts unless stopped
- `999ef2b` doc(bruno): add Logout, Me, Register, and Registration Status endpoints in bruno
- `1e8f8f9` refactor(auth): fix & refactor after code review
- `2f67dee` feat(layout): add AuthLayout and GuestLayout components with theme and language switchers
- `5b1ef3c` feat(theme): implement theme switching functionality with ThemeSwitcher component

**Patterns from recent work:**
- Commit message format: `feat(story X.Y): description` or `feat(auth): description`
- Branch naming: `story-1-5`
- Bruno API files used for endpoint documentation

### Naming Conventions (CRITICAL)

| Element | Convention | Example |
|---------|------------|---------|
| Controller method | camelCase | `login` |
| Validator | camelCase export | `loginValidator` |
| Frontend page | PascalCase + Page | `LoginPage.tsx` |
| Frontend hook | camelCase | `useLogin()` |
| Frontend schema | camelCase | `loginSchema` |
| API route | snake_case | `/api/auth/login` |
| Test file | snake_case | `login.spec.ts` |
| Bruno file | PascalCase | `Login.bru` |

### Anti-Patterns to AVOID

- **DO NOT** use Supabase Auth SDK — auth is AdonisJS native
- **DO NOT** reveal whether email exists on login failure — always "Invalid email or password"
- **DO NOT** add `minLength` to login password validation — only register enforces password strength
- **DO NOT** use `any` type — TypeScript strict mode
- **DO NOT** forget `credentials: 'include'` on fetch calls
- **DO NOT** use ESLint/Prettier — use Biome
- **DO NOT** use Zod — use VineJS
- **DO NOT** display login server error as field-level error — use form-level alert
- **DO NOT** use `this.raw()` in AdonisJS — that's v5 syntax
- **DO NOT** hard-code API URL — use `import.meta.env.VITE_API_URL`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data & Validation]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns - Naming Patterns]
- [Source: _bmad-output/planning-artifacts/prd.md#FR52 - Log in with email/password]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form Patterns]
- [Source: _bmad-output/project-context.md#Authentication]
- [Source: _bmad-output/implementation-artifacts/1-5-implement-user-registration.md]

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-15 | Story created with ultimate context analysis (login: backend API + frontend form + validation + tests) | SM Agent (Opus 4.6) |

### File List
