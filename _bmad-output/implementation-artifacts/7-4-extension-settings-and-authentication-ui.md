# Story 7.4: Extension Settings & Authentication UI

Status: review

## Story

As a BattleCRM user,
I want to configure and authenticate the browser extension with my BattleCRM instance,
So that the extension knows where to connect and can act on my behalf.

## Acceptance Criteria

1. **AC1 (Login screen — first run):** Given the extension is freshly installed (no `token` in `chrome.storage.local`), when the user opens the popup entrypoint, then a setup/login screen is displayed with: BattleCRM URL input (placeholder: `http://localhost:3333`), email input, password input, and a "Se connecter" button.

2. **AC2 (Button disabled):** The "Se connecter" button is disabled until all 3 fields (URL, email, password) are non-empty.

3. **AC3 (Inline errors):** Errors are displayed inline below the form (never as toasts) — "Identifiants invalides" or "Serveur inaccessible" depending on the failure mode. No token is stored on failure.

4. **AC4 (Login success → storage + transition):** Given valid credentials, when "Se connecter" is clicked and the API responds successfully: `token` and `baseUrl` are stored via `setStorage()` from `lib/storage.ts`, the user `email` is also stored, the password is NEVER stored. The UI transitions immediately to the neutral state screen.

5. **AC5 (Neutral state):** Given the user is authenticated and NOT on a `linkedin.com/in/*` page, when the popup opens, the neutral state screen is shown: message "Naviguez vers un profil LinkedIn pour capturer un prospect", an "Ouvrir BattleCRM ↗" button (opens `baseUrl` in a new tab), a settings icon (⚙️) in the header, and "Connecté : `<email>`" in the footer.

6. **AC6 (Settings view):** Given the user clicks the ⚙️ icon, a settings view is displayed showing "Connecté en tant que `<email>`" and a "Se déconnecter" button.

7. **AC7 (Logout flow):** Given the user clicks "Se déconnecter": the popup sends a `{ type: 'LOGOUT' }` message to the service worker, which calls `POST /api/extension/auth/logout` with the Bearer token, then calls `clearAuth()` regardless of API result. The extension returns to the login screen.

8. **AC8 (401 handling):** Given any API call returns 401: `chrome.storage.local` is cleared (`clearAuth()`). The popup, on next open or via message listener, detects no token and shows the login screen. A `"Session expirée, veuillez vous reconnecter"` message is shown if redirected due to 401.

## Tasks / Subtasks

### Task 1: Service worker — LOGOUT message handler (AC7)

- [x] **1.1** In `apps/extension/src/entrypoints/background.ts`, add a `browser.runtime.onMessage.addListener` block. Handle `{ type: 'LOGOUT' }`:
  - Read `{ token, baseUrl }` from `getStorage()` (import from `../lib/storage`)
  - Call `logoutExtension(baseUrl, token)` (import from `../lib/api`) — wrapped in try/catch (ignore failure)
  - Call `clearAuth()` unconditionally
  - Return `{ success: true }` as the response
  > Keep the existing `console.log` stub. The listener must be synchronous at the top level, with `return true` to signal async response (Chrome requirement).

- [x] **1.2** In `apps/extension/src/entrypoints/background.ts`, add a helper `handleAuthExpired()`:
  - Calls `clearAuth()`
  - Broadcasts `{ type: 'AUTH_EXPIRED' }` via `browser.runtime.sendMessage(...)` (best-effort — wrapped in try/catch since popup may not be open)
  > This helper will be called from 7.5/7.6 when API calls return 401. Implement the shell now so the architecture is in place.

### Task 2: Popup — AuthForm component (AC1, AC2, AC3, AC4)

- [x] **2.1** Create `apps/extension/src/components/AuthForm.tsx`:
  ```
  Props:
    onSuccess: (email: string) => void
    initialError?: string   // for "Session expirée..." message passed from App
  
  State:
    baseUrl: string (default '')
    email: string (default '')
    password: string (default '')
    loading: boolean
    error: string | null
  
  Behavior:
    - "Se connecter" button disabled when any field is empty OR loading is true
    - On submit:
        1. Set loading = true, error = null
        2. Call loginExtension(baseUrl, email, password) from lib/api.ts
        3. On success: call setStorage({ token: res.token, baseUrl, email }) then onSuccess(email)
        4. On failure: set error = "Identifiants invalides" (401) or "Serveur inaccessible" (network/other)
        5. Set loading = false
    - Display error below the form (red text, no toast)
    - Password field: type="password"
    - URL field: placeholder="http://localhost:3333"
  ```
  > No shadcn in the extension — use raw `<input>` and `<button>` styled with Tailwind. Match BattleCRM visual style (gray-900 text, border-gray-300 inputs, blue-600 primary button).

- [x] **2.2** The token name in the API call must be: `browser.runtime.getManifest().name` (resolves to "BattleCRM") — do NOT hardcode "Mon Chrome". The `loginExtension` function signature in `lib/api.ts` already accepts `name` as a separate parameter — pass the manifest name.
  > **IMPORTANT:** Check `lib/api.ts:loginExtension` signature — it currently hardcodes `name: 'Mon Chrome'` in the body. Update the function to accept `name` as a parameter.

### Task 3: Popup — NeutralScreen component (AC5)

- [x] **3.1** Create `apps/extension/src/components/NeutralScreen.tsx`:
  ```
  Props:
    email: string
    baseUrl: string
    onSettingsClick: () => void
  
  Layout:
    - Header: "⚔️ BattleCRM" left + "⚙️" button right (onClick → onSettingsClick)
    - Body (centered): "Naviguez vers un profil LinkedIn pour capturer un prospect."
    - Button: "Ouvrir BattleCRM ↗" → browser.tabs.create({ url: baseUrl })
    - Footer: "Connecté : <email>" (small gray text)
  ```
  > `browser.tabs.create` is a WXT global — no import needed.

### Task 4: Popup — SettingsScreen component (AC6, AC7)

- [x] **4.1** Create `apps/extension/src/components/SettingsScreen.tsx`:
  ```
  Props:
    email: string
    onLogout: () => void
    onBack: () => void
  
  Layout:
    - Header: "← Retour" button (onClick → onBack) + "⚔️ BattleCRM" title
    - Body: "Connecté en tant que <email>"
    - Button: "Se déconnecter" (destructive style — red or gray)
  
  Logout behavior (in App.tsx, not here):
    - Send { type: 'LOGOUT' } to service worker via browser.runtime.sendMessage()
    - On response (or error): transition to 'login' screen
  ```

### Task 5: Popup — App.tsx state orchestration (AC1–AC8)

- [x] **5.1** Rewrite `apps/extension/src/entrypoints/popup/App.tsx` with a state machine:
  ```
  Type: 'loading' | 'login' | 'neutral' | 'settings'
  
  Additional state:
    email: string
    baseUrl: string
    sessionExpiredMessage: string | null
  
  On mount (useEffect):
    1. getStorage() → { token, email, baseUrl }
    2. If token exists → set state = 'neutral', email, baseUrl
    3. Else → set state = 'login'
  
  AUTH_EXPIRED listener (useEffect):
    browser.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'AUTH_EXPIRED') {
        setSessionExpiredMessage('Session expirée, veuillez vous reconnecter')
        setState('login')
      }
    })
  
  Render:
    - 'loading' → simple spinner or blank div
    - 'login' → <AuthForm onSuccess={(em) => { setState('neutral'); setEmail(em) }} initialError={sessionExpiredMessage} />
    - 'neutral' → <NeutralScreen email={email} baseUrl={baseUrl} onSettingsClick={() => setState('settings')} />
    - 'settings' → <SettingsScreen email={email} onBack={() => setState('neutral')} onLogout={async () => { await browser.runtime.sendMessage({ type: 'LOGOUT' }); setState('login') }} />
  ```

- [x] **5.2** Keep the `import '../../assets/tailwind.css'` at the top of App.tsx. Wrapper div stays `className="w-72"` (popup width constraint).

### Task 6: Update lib/api.ts (AC4 — token name)

- [x] **6.1** Update `loginExtension` in `apps/extension/src/lib/api.ts` to accept a `name` parameter (optional, default `'Extension'`):
  ```typescript
  export async function loginExtension(
    baseUrl: string,
    email: string,
    password: string,
    name = 'Extension',
  ): Promise<{ token: string; user: { id: string; email: string } }>
  ```
  Change body to use the `name` parameter instead of hardcoded `'Mon Chrome'`.

### Task 7: Verification (AC1–AC8)

- [x] **7.1** `pnpm --filter @battlecrm/extension type-check` → 0 TypeScript errors
- [x] **7.2** `pnpm biome check --write .` → 0 Biome errors
- [x] **7.3** `pnpm build:extension` → success, `apps/extension/.output/chrome-mv3/` exists
- [ ] **7.4** Manual test in Chrome: load unpacked → fresh install → login screen shown → enter valid creds → neutral screen → ⚙️ → settings → logout → login screen

---

## Dev Notes

### Architecture — Popup Is the Only UI in Story 7.4

The popup (`src/entrypoints/popup/`) is the **action popup** — opened by clicking the extension icon in the toolbar. It handles:
- Login screen (no token)
- Neutral state (authenticated, not on LinkedIn profile)
- Settings (logout)

The `panel/` entrypoint (floating window) is for Story 7.6 (prospect add/edit). Do NOT touch it in this story.

### WXT Globals — No Imports Needed

The following are WXT auto-imported globals in all entrypoints:
- `browser.*` — cross-browser polyfill (`browser.storage.local`, `browser.runtime.sendMessage`, `browser.tabs.create`, `browser.runtime.onMessage`, `browser.runtime.getManifest`)
- `defineBackground()`, `defineContentScript()` — for entrypoint definitions

**Never import `browser` manually** — WXT provides it via `.wxt/wxt.d.ts`.

**EXCEPTION:** `browser.*` globals are available in entrypoint files (`background.ts`, `content.ts`, `popup/App.tsx`, `panel/App.tsx`). They are NOT available in `src/lib/*.ts` files — these files are regular TypeScript and need explicit imports. In `lib/storage.ts`, `browser` is already used — this works because WXT injects it at bundle time (Vite processes the extension). In practice, WXT resolves `browser` as a global even in `lib/` files during the build. Keep existing pattern.

### Message Passing Pattern for LOGOUT

```
popup/App.tsx
  └─ browser.runtime.sendMessage({ type: 'LOGOUT' })
       └─ background.ts (service worker)
            ├─ getStorage() → { token, baseUrl }
            ├─ logoutExtension(baseUrl, token) — API call (may fail)
            └─ clearAuth() — always clear storage
```

**Chrome MV3 requirement:** In `background.ts`, the `onMessage.addListener` callback MUST return `true` if it uses async processing — otherwise Chrome will close the message channel before the Promise resolves:
```typescript
browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'LOGOUT') {
    handleLogout().then(() => sendResponse({ success: true }))
    return true  // ← CRITICAL: keep channel open for async response
  }
})
```

### Tailwind in Extension — PostCSS Setup (Not @tailwindcss/vite)

Story 7.3 established: use `@tailwindcss/postcss` via `postcss.config.mjs` (NOT `@tailwindcss/vite`) — avoids Vite version conflict with WXT 0.20.20. Import Tailwind in each entrypoint's `App.tsx`:
```typescript
import '../../assets/tailwind.css'
```

### No shadcn/ui in Extension

The extension does NOT have shadcn/ui installed. Use raw HTML elements styled with Tailwind:
- Inputs: `<input className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />`
- Primary button: `<button className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">...</button>`
- Error text: `<p className="mt-2 text-sm text-red-600">...</p>`

Visual goal: same feel as BattleCRM web app (same Tailwind palette, same shape language).

### Popup Width Constraint

Chrome limits popup width. The existing `w-72` (288px) is the established popup width — keep it. The login form fits comfortably in 288px. Do NOT change the wrapper `<div>` width.

### browser.tabs.create in Popup Context

`browser.tabs.create({ url: baseUrl })` is the correct API to open BattleCRM in a new tab from the popup. This is a WXT global — no import needed. The popup will close automatically when focus shifts to the new tab (Chrome default behavior).

### File Locations (This Story)

| New file | Purpose |
|----------|---------|
| `apps/extension/src/components/AuthForm.tsx` | Login form component |
| `apps/extension/src/components/NeutralScreen.tsx` | Authenticated + not on LinkedIn |
| `apps/extension/src/components/SettingsScreen.tsx` | Logout UI |

| Modified file | What changes |
|---------------|-------------|
| `apps/extension/src/entrypoints/popup/App.tsx` | State machine: login → neutral → settings |
| `apps/extension/src/entrypoints/background.ts` | LOGOUT message handler + handleAuthExpired() |
| `apps/extension/src/lib/api.ts` | loginExtension: add `name` parameter |

### Previous Story Learnings (Story 7.3)

- **`main.tsx` + `App.tsx` pattern**: `main.tsx` mounts React root, `App.tsx` is the pure component. Both exist — only touch `App.tsx` for logic changes.
- **Tailwind via PostCSS**: `postcss.config.mjs` is the config file, not `tailwind.config.js`. Do not add one.
- **WXT auto-imports**: Never import `defineBackground` or `browser` manually — they are injected by WXT.
- **`tsconfig.json` standalone**: Do not change it. The current config avoids the Vite 7/esbuild incompatibility with `.wxt/tsconfig.json` extends.
- **`pnpm build:extension` from root**: Always verify this passes — it's the AC gate.
- **Biome `w-105`**: Tailwind v4 canonical class for 420px. For popup: use `w-72` (288px) as established.

### References

- [Source: _bmad-output/planning-artifacts/epics.md → Story 7.4: Extension Settings & Authentication UI]
- [Source: _bmad-output/planning-artifacts/architecture.md → Browser Extension Architecture (Epic 7)]
- [Source: _bmad-output/planning-artifacts/architecture.md → Stockage du Token Côté Extension]
- [Source: _bmad-output/planning-artifacts/architecture.md → Cycle de Vie du Service Worker]
- [Source: _bmad-output/planning-artifacts/architecture.md → Flux de Données]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md → Écran 1: Setup & Authentification]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md → Écran 2: État Neutre]
- [Source: apps/extension/src/lib/storage.ts] — getStorage, setStorage, clearAuth
- [Source: apps/extension/src/lib/api.ts] — loginExtension, logoutExtension signatures
- [Source: apps/extension/src/entrypoints/background.ts] — existing service worker stub
- [Source: apps/extension/src/entrypoints/popup/App.tsx] — existing stub (w-72 width)

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- **`background.ts` LOGOUT handler**: `browser.runtime.onMessage.addListener` avec `return true` pour garder le channel ouvert (contrainte Chrome MV3 async). `handleLogout()` : lit token+baseUrl depuis storage, appelle `logoutExtension` (try/catch — ignore les erreurs API), puis `clearAuth()` inconditionnellement.
- **`handleAuthExpired()` exporté**: shell prêt pour les stories 7.5/7.6 — clear storage + broadcast `AUTH_EXPIRED` (best-effort, popup peut ne pas être ouverte).
- **`loginExtension` — paramètre `name`**: ajout du paramètre `name = 'Extension'`. `AuthForm` passe `browser.runtime.getManifest().name` (= "BattleCRM"). La valeur hardcodée `'BattleCRM Extension'` a été remplacée.
- **Machine à états popup**: `'loading' | 'login' | 'neutral' | 'settings'`. Montage asynchrone via `getStorage()` — évite un flash login si déjà authentifié. Listener `AUTH_EXPIRED` proprement nettoyé via cleanup effect.
- **Tailwind sans shadcn**: raw HTML inputs/buttons. Style cohérent avec BattleCRM (blue-600, border-gray-300, text-sm).
- **Biome**: 1 fix auto-appliqué (réorganisation props `SettingsScreen` dans App.tsx). Build repasse au vert.
- **Build final**: `pnpm build:extension` → 216.29 kB, 0 erreur. `type-check` → 0 erreur. `biome check` → 0 erreur.
- **Task 7.4**: vérification manuelle Chrome requise — impossible à automatiser en CI.

### File List

**New files:**
- `apps/extension/src/components/AuthForm.tsx` — Login form (3 inputs, inline errors, disabled button, browser.runtime.getManifest().name)
- `apps/extension/src/components/NeutralScreen.tsx` — État authentifié hors LinkedIn (header ⚙️, bouton Ouvrir BattleCRM, footer email)
- `apps/extension/src/components/SettingsScreen.tsx` — Déconnexion (bouton Se déconnecter → LOGOUT message)

**Modified files:**
- `apps/extension/src/entrypoints/background.ts` — LOGOUT message handler + handleAuthExpired() shell
- `apps/extension/src/entrypoints/popup/App.tsx` — Machine à états login/neutral/settings
- `apps/extension/src/lib/api.ts` — loginExtension: ajout paramètre `name = 'Extension'`
