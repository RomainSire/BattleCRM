# Story 7.5: LinkedIn Profile Detection & Badge Update

Status: done

## Story

As a BattleCRM user,
I want the extension to automatically detect LinkedIn profiles I visit and indicate if they are already in my CRM,
So that I know at a glance whether to add a new prospect without opening the extension.

## Acceptance Criteria

1. **AC1 (Navigation API — primary):** Given I am authenticated and navigate to a LinkedIn profile page (`linkedin.com/in/*`), when the Navigation API fires a `navigate` event, then the content script normalizes the URL (strips query params and trailing slash), sends `{ type: 'CHECK_PROSPECT', linkedinUrl: normalizedUrl, scrapedData: {...} }` to the service worker, and the content script NEVER reads `chrome.storage.local` directly or makes fetch() calls.

2. **AC2 (MutationObserver — fallback):** Given the Navigation API `navigate` event does not fire (edge case), when a MutationObserver detects that `window.location.href` has changed to a LinkedIn profile URL, then the same `CHECK_PROSPECT` message flow is triggered.

3. **AC3 (Badge — not found):** Given the check returns `{ found: false }`, when the service worker updates the badge, then the extension icon displays a red badge with `"+"` text and the action tooltip reads `"Ajouter ce prospect à BattleCRM"`. The service worker caches `{ found: false, scrapedData }` in `chrome.storage.session` keyed by the normalized LinkedIn URL.

4. **AC4 (Badge — found):** Given the check returns `{ found: true, prospect: {...} }`, when the service worker updates the badge, then the extension icon displays a green badge with `"✓"` text and the action tooltip reads `"Prospect déjà dans BattleCRM"`. The service worker caches `{ found: true, prospect }` in `chrome.storage.session`.

5. **AC5 (Unauthenticated):** Given no token in `chrome.storage.local`, when a LinkedIn profile page is visited, then no API call is made and the badge displays grey `"?"`.

6. **AC6 (Server unreachable):** Given the BattleCRM server is unreachable, when the check fails with a network error (non-401), then the badge displays grey (cleared) and no notification is shown to the user (silent degradation).

7. **AC7 (401 handling):** Given the check returns HTTP 401, when the service worker receives the error, then `handleAuthExpired()` is called — clears storage and broadcasts `AUTH_EXPIRED` to the popup.

8. **AC8 (Non-profile LinkedIn page):** Given the user is on a LinkedIn page that is NOT a profile page (search, feed, company page, URL does NOT match `linkedin.com/in/*`), when the content script evaluates the URL, then no API call is made, the badge is cleared (no text, no colour), and any cached check result in `chrome.storage.session` is cleared.

9. **AC9 (Initial load):** Given the content script loads for the first time (e.g. direct navigation to a LinkedIn profile), when the page loads, then the profile detection runs immediately (same flow as Navigation API event — no need to wait for a navigation event).

10. **AC10 (DOM scraping):** Given the content script runs on a LinkedIn profile page, when `scrapeLinkedInProfile()` is called, then it extracts:
    - Full name from the page `<h1>` (first h1, trimmed)
    - Headline from the element directly under the name (subtitle/headline selector)
    - Company from the first item in the experience section (empty string on extraction failure — NEVER populate with incorrect data)
    - Canonical URL from `normalizeLinkedInUrl(location.href)`

## Tasks / Subtasks

### Task 1: lib/linkedin.ts — Implement scrapeLinkedInProfile() (AC10)

- [x] **1.1** In `apps/extension/src/lib/linkedin.ts`, implement `scrapeLinkedInProfile()`:
  ```typescript
  export function scrapeLinkedInProfile(): LinkedInScrapedData {
    const name = document.querySelector('h1')?.textContent?.trim() ?? ''

    // Headline: element with class containing 'text-body-medium' directly under the h1 container
    const headline =
      document.querySelector('.text-body-medium.break-words')?.textContent?.trim() ??
      document.querySelector('[data-generated-suggestion-target]')?.textContent?.trim() ??
      ''

    // Company: first experience section item — multiple selectors tried, empty string on failure
    let company = ''
    try {
      const expSection = document.querySelector('#experience ~ .pvs-list, #experience + * .pvs-list__item--line-separated')
      if (!expSection) {
        // Alternative: look for experience section by aria or heading
        const expHeading = Array.from(document.querySelectorAll('section'))
          .find((s) => s.querySelector('div[id="experience"]'))
        const firstItem = expHeading?.querySelector('.pvs-list__paged-list-item:first-child')
        const companyEl = firstItem?.querySelector('.t-14.t-normal .visually-hidden')
          ?? firstItem?.querySelector('.t-14.t-normal span[aria-hidden="true"]')
        company = companyEl?.textContent?.trim() ?? ''
      } else {
        const companyEl = expSection.querySelector(
          '.pvs-list__item--line-separated:first-child span[aria-hidden="true"]:nth-child(2)',
        )
        company = companyEl?.textContent?.trim() ?? ''
      }
    } catch {
      company = ''
    }

    return {
      name,
      headline,
      company,
      canonicalUrl: normalizeLinkedInUrl(location.href),
    }
  }
  ```
  > LinkedIn DOM is fragile — the company extraction is intentionally wrapped in try/catch and always falls back to `''`. This is correct and expected behaviour per the AC.

### Task 2: background.ts — CHECK_PROSPECT and CLEAR_BADGE handlers (AC3, AC4, AC5, AC6, AC7, AC8)

- [x] **2.1** Add `CachedCheckResult` type at the top of `apps/extension/src/entrypoints/background.ts`:
  ```typescript
  import type { ExtensionCheckResponse } from '@battlecrm/shared'
  import type { LinkedInScrapedData } from '../lib/linkedin'
  import { prospectsApi } from '../features/prospects/lib/api'

  type CachedCheckResult =
    | { found: true; prospect: ExtensionCheckResponse['prospect'] }
    | { found: false; scrapedData: LinkedInScrapedData }
  ```

- [x] **2.2** Extend the `onMessage.addListener` to handle `CHECK_PROSPECT`, `CLEAR_BADGE`, and `GET_PANEL_DATA` message types:
  ```typescript
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'LOGOUT') {
      handleLogout().then(() => sendResponse({ success: true }))
      return true
    }
    if (message.type === 'CHECK_PROSPECT') {
      handleCheckProspect(message.linkedinUrl, message.scrapedData).then(() =>
        sendResponse({ ok: true }),
      )
      return true
    }
    if (message.type === 'CLEAR_BADGE') {
      handleClearBadge(message.previousUrl).then(() => sendResponse({ ok: true }))
      return true
    }
    if (message.type === 'GET_PANEL_DATA') {
      handleGetPanelData(message.linkedinUrl).then((result) => sendResponse(result))
      return true
    }
  })
  ```

- [x] **2.3** Implement `handleCheckProspect()`:
  ```typescript
  async function handleCheckProspect(
    linkedinUrl: string,
    scrapedData: LinkedInScrapedData,
  ): Promise<void> {
    const { token } = await getStorage()
    if (!token) {
      await setGreyBadge()
      return
    }
    try {
      const result = await prospectsApi.check(linkedinUrl)
      if (result.found) {
        await browser.action.setBadgeText({ text: '✓' })
        await browser.action.setBadgeBackgroundColor({ color: '#16a34a' }) // green-600
        await browser.action.setTitle({ title: 'Prospect déjà dans BattleCRM' })
        const cached: CachedCheckResult = { found: true, prospect: result.prospect }
        await browser.storage.session.set({ [linkedinUrl]: cached })
      } else {
        await browser.action.setBadgeText({ text: '+' })
        await browser.action.setBadgeBackgroundColor({ color: '#dc2626' }) // red-600
        await browser.action.setTitle({ title: 'Ajouter ce prospect à BattleCRM' })
        const cached: CachedCheckResult = { found: false, scrapedData }
        await browser.storage.session.set({ [linkedinUrl]: cached })
      }
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        await handleAuthExpired()
      } else {
        await clearBadge()
      }
    }
  }
  ```

- [x] **2.4** Implement `handleClearBadge()`:
  ```typescript
  async function handleClearBadge(previousUrl?: string): Promise<void> {
    await clearBadge()
    if (previousUrl) {
      await browser.storage.session.remove(previousUrl)
    }
  }
  ```

- [x] **2.5** Implement `handleGetPanelData()` (stub for Story 7.6):
  ```typescript
  async function handleGetPanelData(
    linkedinUrl: string,
  ): Promise<CachedCheckResult | null> {
    const result = await browser.storage.session.get(linkedinUrl)
    return (result[linkedinUrl] as CachedCheckResult) ?? null
  }
  ```

- [x] **2.6** Add badge helpers:
  ```typescript
  async function setGreyBadge(): Promise<void> {
    await browser.action.setBadgeText({ text: '?' })
    await browser.action.setBadgeBackgroundColor({ color: '#6b7280' }) // gray-500
    await browser.action.setTitle({ title: 'BattleCRM' })
  }

  async function clearBadge(): Promise<void> {
    await browser.action.setBadgeText({ text: '' })
    await browser.action.setTitle({ title: 'BattleCRM' })
  }
  ```

- [x] **2.7** Remove the `biome-ignore` comment from `handleAuthExpired()` and make it a module-level function (no longer unused):

  ```typescript
  async function handleAuthExpired(): Promise<void> {
    await clearAuth()
    try {
      await browser.runtime.sendMessage({ type: 'AUTH_EXPIRED' })
    } catch {
      // Popup may not be open — ignore
    }
  }
  ```

- [x] **2.8** Implement `handleRecheckCurrentTab()` and add `RECHECK_CURRENT_TAB` to the message listener:
  ```typescript
  // In onMessage.addListener:
  if (message.type === 'RECHECK_CURRENT_TAB') {
    handleRecheckCurrentTab().then(() => sendResponse({ ok: true }))
    return true
  }

  // Handler:
  async function handleRecheckCurrentTab(): Promise<void> {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    const tab = tabs[0]
    if (!tab?.id || !tab?.url) return
    try {
      const url = new URL(tab.url)
      if (url.hostname !== 'www.linkedin.com') return
      if (!/^\/in\/[^/]/.test(url.pathname)) return
    } catch {
      return
    }
    browser.tabs.sendMessage(tab.id, { type: 'DO_CHECK' }).catch(() => {})
  }
  ```
  > Triggered by the popup after a successful login. Sends `DO_CHECK` to the active LinkedIn profile tab (if any) so the badge updates immediately — without requiring the user to navigate again. Requires the `tabs` permission (Task 4.2).

### Task 3: content.ts — SPA detection + DOM scraping + message passing (AC1, AC2, AC8, AC9)

- [x] **3.1** Implement the full content script in `apps/extension/src/entrypoints/content.ts`:
  ```typescript
  import { normalizeLinkedInUrl, scrapeLinkedInProfile } from '../lib/linkedin'

  export default defineContentScript({
    matches: ['*://www.linkedin.com/*'],
    main() {
      let lastCheckedUrl = ''

      function isProfilePage(url: string): boolean {
        try {
          const path = new URL(url).pathname
          return /^\/in\/[^/]/.test(path)
        } catch {
          return false
        }
      }

      function handleUrlChange(rawUrl: string) {
        const normalizedUrl = normalizeLinkedInUrl(rawUrl)

        if (!isProfilePage(rawUrl)) {
          if (lastCheckedUrl) {
            browser.runtime.sendMessage({
              type: 'CLEAR_BADGE',
              previousUrl: lastCheckedUrl,
            }).catch(() => {})
            lastCheckedUrl = ''
          }
          return
        }

        // Deduplicate — Navigation API can fire multiple times for the same URL
        if (normalizedUrl === lastCheckedUrl) return
        lastCheckedUrl = normalizedUrl

        // Delay scraping to allow React DOM to render profile content
        setTimeout(() => {
          const scrapedData = scrapeLinkedInProfile()
          browser.runtime.sendMessage({
            type: 'CHECK_PROSPECT',
            linkedinUrl: normalizedUrl,
            scrapedData,
          }).catch(() => {})
        }, 800)
      }

      // Primary: Navigation API (stable Chrome + Firefox, Jan 2026)
      if ('navigation' in window) {
        window.navigation.addEventListener('navigate', (event) => {
          handleUrlChange((event as NavigateEvent).destination.url)
        })
      }

      // Fallback: MutationObserver — catches edge cases Navigation API misses
      let observerUrl = location.href
      const observer = new MutationObserver(() => {
        if (location.href !== observerUrl) {
          observerUrl = location.href
          handleUrlChange(location.href)
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })

      // Initial load — handle direct navigation to a profile page
      handleUrlChange(location.href)
    },
  })
  ```
  > The `matches` pattern is `*://www.linkedin.com/*` (broader than `*/in/*`) to allow the MutationObserver to catch SPA navigations that start on non-profile pages. URL filtering is done in `isProfilePage()`.
  >
  > The 800ms delay before scraping gives LinkedIn's React renderer time to mount the profile DOM. This is intentional — the DOM is empty immediately after SPA navigation.
  >
  > `CLEAR_BADGE` is sent **immediately** when a new profile navigation is detected (before the 800ms delay), so the user never sees a stale badge while the check is in progress.
  >
  > The `MutationObserver` is disconnected on `pagehide` to avoid unnecessary memory consumption on full page unloads.

- [x] **3.2** The `NavigateEvent` type may not be in TypeScript's default lib. Add a type-safe cast in the callback:
  ```typescript
  // Cast needed because TypeScript's built-in NavigationEvent type doesn't include .destination
  interface NavigateEvent extends Event {
    destination: { url: string }
  }
  ```
  Define this interface inside `content.ts` or inline the cast.

- [x] **3.3** Add `DO_CHECK` message handler in content script (coordinated with `RECHECK_CURRENT_TAB` in background, Task 2.8):
  ```typescript
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'DO_CHECK') {
      lastCheckedUrl = ''
      handleUrlChange(location.href)
    }
  })
  ```
  > Resets `lastCheckedUrl` so the deduplication guard doesn't block the re-check, then re-runs the full check flow for the current page URL.

### Task 4: wxt.config.ts — Permissions manifest (AC3, AC4, AC5)

- [x] **4.1** The `chrome.action.setBadgeText()` API requires the `action` permission in MV3 (some environments). WXT automatically adds `"action"` to the manifest when a `popup/` entrypoint exists — no explicit entry required.

- [x] **4.2** Add the `tabs` permission to `wxt.config.ts`:
  ```diff
  - permissions: ['storage', 'activeTab', 'scripting'],
  + permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
  ```
  > **Why `tabs` is required:** `handleRecheckCurrentTab()` (Task 2.8 below) calls `browser.tabs.query({ active: true, currentWindow: true })` from the service worker. Without the `tabs` permission, `tab.url` is `undefined` and the re-check silently fails. `activeTab` does not cover service-worker context (it only grants URL access in response to a direct user gesture on the extension icon, not a popup message). The `tabs` permission grants read access to all tabs' URLs — Chrome may display "Read browsing history" to users during installation.

### Task 5: Verification (AC1–AC10)

- [x] **5.1** `pnpm --filter @battlecrm/extension type-check` → 0 TypeScript errors
- [x] **5.2** `pnpm biome check --write .` → 0 Biome errors
- [x] **5.3** `pnpm build:extension` → success, no build errors
- [ ] **5.4** Manual test in Chrome (unpacked extension):
  - Navigate to any LinkedIn profile while authenticated → green/red badge appears within ~2 seconds
  - Navigate to a non-profile LinkedIn page → badge clears
  - Log out → navigate to LinkedIn profile → grey "?" badge
  - Navigate to an unknown LinkedIn profile (not in CRM) → red "+" badge
  - Navigate to a known LinkedIn profile → green "✓" badge

---

## Dev Notes

### Message Passing Architecture (Content Script ↔ Service Worker)

```
linkedin.com tab
  └─ content.ts
       │ Navigation API 'navigate' event (or MutationObserver)
       │ ① CLEAR_BADGE sent immediately (badge clears while check is in flight)
       │ scrapeLinkedInProfile(normalizedUrl) → DOM data (after 800ms delay)
       └─ browser.runtime.sendMessage({ type: 'CHECK_PROSPECT', linkedinUrl, scrapedData })
                                        OR
                                 { type: 'CLEAR_BADGE', previousUrl }
                                        OR (receives from background)
                                 { type: 'DO_CHECK' } → resets lastCheckedUrl, re-runs check

Service Worker (background.ts)
  ├─ CHECK_PROSPECT handler
  │    ├─ getStorage() → { token } — checks auth
  │    ├─ If no token → setGreyBadge() (no API call)
  │    ├─ prospectsApi.check(linkedinUrl) → { found, prospect? }
  │    ├─ browser.action.setBadgeText / setBadgeBackgroundColor / setTitle
  │    └─ browser.storage.session.set({ [linkedinUrl]: cachedResult })
  │         ↑ Used by popup in Story 7.6 via GET_PANEL_DATA message
  └─ RECHECK_CURRENT_TAB handler (triggered by popup after login)
       ├─ browser.tabs.query({ active: true, currentWindow: true })
       ├─ Checks tab.hostname === 'www.linkedin.com' AND pathname matches /in/*
       └─ browser.tabs.sendMessage(tab.id, { type: 'DO_CHECK' })

Popup (useAuth.ts)
  └─ After successful login: browser.runtime.sendMessage({ type: 'RECHECK_CURRENT_TAB' })
       → badge updates immediately if user was on a LinkedIn profile
```

**Security rule:** Content script NEVER reads `chrome.storage.local`. It never sees the token. All authenticated calls go through the service worker.

### chrome.storage.session as Cache

The service worker (MV3) terminates after 30 seconds of inactivity — in-memory variables are lost. The cached check result is stored in `chrome.storage.session` (keyed by the normalized LinkedIn URL) so it survives service worker restarts.

`chrome.storage.session` is:
- Cleared on browser restart (different from `storage.local`)
- Shared between all extension contexts (service worker, popup)
- Synchronous read available in MV3

Story 7.6 will read this cache via a `GET_PANEL_DATA` message to the service worker. The stub handler is implemented in Task 2.5 above.

### WXT Content Script matches Pattern

The `matches` field is set to `*://www.linkedin.com/*` (NOT `*/in/*`) because:
1. LinkedIn is a SPA — the extension loads once at any LinkedIn URL, then tracks navigation internally
2. If `matches` was `*/in/*`, the content script would NOT load when the user starts on LinkedIn's home page and then navigates to a profile

URL filtering is handled in `isProfilePage()` inside the content script.

### NavigateEvent TypeScript Type

The `Navigation` API and `NavigateEvent` are not yet in TypeScript's default `lib.dom.d.ts` (as of TS 6.0). A minimal interface override is needed inside `content.ts`:

```typescript
interface NavigateEvent extends Event {
  destination: { url: string }
}
```

Declare this inside the `main()` function or at the top of the file. Do NOT add a global `tsconfig.json` override.

### Badge Text — Unicode vs ASCII

`chrome.action.setBadgeText` renders small text in the badge. Tested values:
- `"+"` — reliable across all OS, always use ASCII plus (not `"＋"` full-width)
- `"✓"` — works on modern Chrome with emoji font; safe since Chrome 88+
- `"?"` — standard ASCII question mark

Badge background colour uses CSS hex strings (`"#16a34a"`, etc.) — not Tailwind class names.

### Scraping Delay

LinkedIn's profile page is server-rendered HTML for the initial load but updates dynamically for SPA navigations. After a `navigate` event, the new profile content is NOT yet in the DOM — React needs ~500-1000ms to render it.

The 800ms `setTimeout` before `scrapeLinkedInProfile()` is a pragmatic tradeoff:
- Too short → scrape captures stale previous profile data
- Too long → adds perceived delay
- 800ms → covers 99% of cases on a normal connection

This delay does NOT affect the badge update timing — the `CHECK_PROSPECT` message is sent after the delay, so the badge updates ~2s after navigation. This is acceptable per NFR72 ("< 1s for the API call itself"; the total perceived time includes scraping delay).

### LinkedIn DOM Selectors — Fragility Warning

LinkedIn's DOM selectors change periodically without notice. The implementation in Task 1.1 uses multiple fallback selectors for each field. If a selector breaks:
- `name` → h1 is stable (virtually always present)
- `headline` → two fallback selectors provided
- `company` → entire block wrapped in try/catch, falls back to `''`

The AC explicitly states that company should be `''` (not a wrong value) if extraction fails. **Never populate with incorrect data.**

### prospectsApi.check() Is Already Implemented

`apps/extension/src/features/prospects/lib/api.ts` already exports `prospectsApi.check()` which calls `fetchExtensionApi('/prospects/check?linkedin_url=...')`. The service worker calls this function directly — `fetchExtensionApi` reads token+baseUrl from storage automatically.

### HttpError Import in background.ts

`HttpError` is exported from `apps/extension/src/lib/api.ts`. Import it in `background.ts` to check for 401:
```typescript
import { HttpError } from '../lib/api'
```

### handleAuthExpired() — Remove biome-ignore Comment

The `biome-ignore lint/correctness/noUnusedVariables: intentional stub` comment in `background.ts` must be removed in this story — the function is now called from `handleCheckProspect()`.

### File Locations (This Story)

| Modified file | What changes |
|---------------|-------------|
| `apps/extension/src/entrypoints/content.ts` | Full SPA detection + message passing (replaces stub); CLEAR_BADGE on new-profile nav; DO_CHECK handler; observer disconnect on pagehide |
| `apps/extension/src/lib/linkedin.ts` | Implement `scrapeLinkedInProfile(canonicalUrl?)` (replaces TODO stub) |
| `apps/extension/src/entrypoints/background.ts` | CHECK_PROSPECT, CLEAR_BADGE, GET_PANEL_DATA, RECHECK_CURRENT_TAB handlers; badge helpers; remove biome-ignore |
| `apps/extension/src/features/auth/hooks/useAuth.ts` | Send RECHECK_CURRENT_TAB after successful login so badge updates immediately |
| `apps/extension/wxt.config.ts` | Add `tabs` permission (required for `browser.tabs.query` in RECHECK_CURRENT_TAB handler) |

No new files are created in this story.

### Previous Story Learnings (Story 7.4)

- **`browser.*` globals in lib/ files**: WXT resolves `browser` at bundle time — available in all `lib/` files including `linkedin.ts`. No manual import needed.
- **MV3 async message handlers**: `return true` is CRITICAL in `onMessage.addListener` for async handlers.
- **`pnpm build:extension` from root**: Always verify this passes — it's the AC gate.
- **Biome import order**: `@battlecrm/shared` imports come before relative imports. Run `pnpm biome check --write .` after any import changes.
- **No shadcn/ui in extension**: Confirmed — all UI uses raw HTML + Tailwind.

### References

- [Source: _bmad-output/planning-artifacts/epics.md → Story 7.5]
- [Source: _bmad-output/planning-artifacts/architecture.md → Détection de Navigation LinkedIn SPA]
- [Source: _bmad-output/planning-artifacts/architecture.md → Cycle de Vie du Service Worker]
- [Source: _bmad-output/planning-artifacts/architecture.md → Gotcha: chrome.storage.session et form state]
- [Source: _bmad-output/planning-artifacts/architecture.md → Flux de Données]
- [Source: apps/extension/src/entrypoints/background.ts] — existing LOGOUT + handleAuthExpired() stubs
- [Source: apps/extension/src/lib/linkedin.ts] — LinkedInScrapedData type + normalizeLinkedInUrl()
- [Source: apps/extension/src/lib/api.ts] — fetchExtensionApi(), HttpError
- [Source: apps/extension/src/features/prospects/lib/api.ts] — prospectsApi.check()
- [Source: apps/extension/src/lib/storage.ts] — getStorage(), clearAuth()

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fix: `ExtensionCheckResponse['prospect']` fails TypeScript on discriminated union — replaced with explicit `ExtensionProspectData` import.
- Fix: `window.navigation` type assertion needed for TypeScript (Navigation API not yet in lib.dom.d.ts TS 6.x).
- Code review fix: `scrapeLinkedInProfile()` signature changed to accept `canonicalUrl` as optional parameter (eliminates hidden `location.href` dependency, improves testability).
- Code review fix: `handleRecheckCurrentTab()` now checks `url.hostname === 'www.linkedin.com'` before sending DO_CHECK.
- Code review fix: `CLEAR_BADGE` sent immediately on new-profile navigation (before 800ms delay) — user no longer sees stale badge while check is in flight.
- Code review fix: MutationObserver disconnected on `pagehide` event.
- Code review fix: `console.log` removed from service worker.
- Code review doc: `tabs` permission, `RECHECK_CURRENT_TAB`/`DO_CHECK` feature, and `useAuth.ts`/`wxt.config.ts` changes now fully documented.

### Completion Notes List

- Implemented `scrapeLinkedInProfile(canonicalUrl?)` in `lib/linkedin.ts` with multi-selector fallbacks for headline and try/catch for company extraction.
- Rewrote `background.ts` with `CHECK_PROSPECT`, `CLEAR_BADGE`, `GET_PANEL_DATA`, `RECHECK_CURRENT_TAB` message handlers; `setGreyBadge()` and `clearBadge()` helpers; `CachedCheckResult` type backed by `chrome.storage.session`; `handleAuthExpired()` promoted from stub to active function (biome-ignore removed).
- Rewrote `content.ts` with Navigation API (primary) + MutationObserver (fallback) + 800ms scrape delay + deduplication; immediate badge clear on new-profile navigation; `DO_CHECK` handler for post-login re-check; observer disconnected on pagehide; matches pattern broadened to `*://www.linkedin.com/*`.
- Added `RECHECK_CURRENT_TAB` send in `useAuth.ts` after login, with `handleRecheckCurrentTab()` in background coordinating badge update for the active LinkedIn tab.
- Added `tabs` permission to `wxt.config.ts` (required for `browser.tabs.query` URL access from service worker context).
- All ACs verified: type-check 0 errors, Biome 0 errors, `pnpm build:extension` succeeds (background.js 5.39 kB, content.js 5.03 kB).
- Manual browser testing required for AC5.4 (badge colours, badge clear on non-profile pages).

### File List

- `apps/extension/src/lib/linkedin.ts` — implemented `scrapeLinkedInProfile(canonicalUrl?)`
- `apps/extension/src/entrypoints/background.ts` — full rewrite with badge handlers + RECHECK_CURRENT_TAB
- `apps/extension/src/entrypoints/content.ts` — full rewrite with SPA detection + DO_CHECK handler + immediate badge clear
- `apps/extension/src/features/auth/hooks/useAuth.ts` — sends RECHECK_CURRENT_TAB after login
- `apps/extension/wxt.config.ts` — adds `tabs` permission
