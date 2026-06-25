# BattleCRM Browser Extension — Installation Guide

## Overview

The BattleCRM extension detects LinkedIn profiles and lets you add or update prospects in BattleCRM without leaving the browser. It authenticates with a Bearer token, separate from the web-app session (the token lives in `chrome.storage.local` and survives browser restarts).

**Supported browsers:** Chrome / Chromium (MV3) · Firefox 115+ (MV3)

There are two ways to install:

- **[A. Install a signed release](#a-install-a-signed-release-recommended)** — the easy path, no build needed.
- **[B. Build from source](#b-build-from-source-development)** — for development / hacking on the extension.

---

## A. Install a signed release (recommended)

Each `vX.Y.Z` git tag triggers a GitHub Actions workflow that builds the extension, gets it **signed by Mozilla (AMO)**, and publishes a **GitHub Release** with the installable files attached.

Go to the repository's **Releases** page and grab the latest one.

### Firefox — one-click install

1. In Firefox, **open the `.xpi` file's link directly** from the Release page (or drag the downloaded `.xpi` onto a Firefox window).
2. Firefox prompts to install — confirm.
3. Because the `.xpi` is **AMO-signed**, it installs **permanently** (survives restarts). No developer mode, no `about:debugging`.

> Alternative: `about:addons` → gear icon → **Install Add-on From File…** → pick the `.xpi`.

### Chrome / Chromium

Chrome only installs signed extensions from the Web Store, so for a self-hosted build you load it unpacked:

1. Download the `*-chrome.zip` asset from the Release and unzip it.
2. Open `chrome://extensions`, enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the unzipped folder.

> The Chrome extension ID is pinned by the `key` field in `wxt.config.ts`, so it stays stable (`aigeldhmbeopfpaeokckafajeneccbkc`).

→ Once installed, jump to **[First use & connecting](#first-use--connecting)**.

---

## B. Build from source (development)

### Prerequisites

- Node.js ≥ 20.6 and pnpm installed
- Repository cloned, dependencies installed (`pnpm install` at the root)

### Build

Run from the **repository root**:

```bash
# Chrome / Chromium (MV3)
pnpm build:extension

# Firefox (MV3)
pnpm --filter @battlecrm/extension build:firefox
```

| Browser | Output directory |
|---------|-----------------|
| Chrome  | `apps/extension/.output/chrome-mv3/` |
| Firefox | `apps/extension/.output/firefox-mv3/` |

### Load it

- **Chrome:** `chrome://extensions` → **Developer mode** → **Load unpacked** → select `apps/extension/.output/chrome-mv3/`.
- **Firefox (temporary):** `about:debugging` → **This Firefox** → **Load Temporary Add-on…** → select `apps/extension/.output/firefox-mv3/manifest.json`.
  > Temporary add-ons disappear on restart. For a permanent unsigned install, use Firefox Developer Edition / ESR with `xpinstall.signatures.required = false` in `about:config`, or install a signed release (option A).

---

## First use & connecting

1. Open a LinkedIn profile page (e.g. `linkedin.com/in/someone`).
2. Click the **BattleCRM** icon in your browser toolbar.
3. In the login form, fill in:
   - **URL BattleCRM** — the base URL of your BattleCRM instance, **without trailing slash and without `/api`**.
     Examples: `https://battlecrm.romainsire.com` (prod) · `http://localhost:3333` (local dev)
   - **Email** and **Password** — your BattleCRM account credentials.
4. Click **Se connecter**.

The toolbar badge then reflects the current profile:
- **green ✓** — already in BattleCRM (popup lets you view/edit);
- **red +** — new profile — a pre-filled form lets you add it as a prospect.

On the LinkedIn **people-search list**, each result also gets a small BattleCRM logo badge (green ✓ / red +) showing whether it's already in your CRM.

> The token + base URL are stored in `chrome.storage.local` (persist across browser restarts). Per-profile form state is cached in `chrome.storage.session` and survives popup close/reopen. Tokens expire after 180 days (fixed) — you'll need to log in again then.

---

## CORS / backend configuration

The backend automatically accepts any browser-extension origin (`chrome-extension://…` and `moz-extension://…`) — see `apps/backend/config/cors.ts`. This is required because **Firefox generates a random `moz-extension://` origin per install** that can't be whitelisted ahead of time. It's safe: extension endpoints authenticate via Bearer tokens, not cookies.

You therefore **do not need to set `EXTENSION_ORIGINS`** for the extension to connect. The variable still exists for explicitly allowing other (non-extension) origins, but it's optional and unrelated to extension auth.

> If you change the backend domain, the extension just needs the new URL in its login form — no manifest or CORS change required.

---

## Cutting a new signed release (maintainers)

1. Bump the version in `apps/extension/package.json` (AMO refuses to re-sign an existing version, so this is mandatory each time).
2. Commit, then tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
3. The `release.yml` workflow builds Firefox + Chrome, signs the Firefox build via AMO, and creates the GitHub Release with the `.xpi` and Chrome zip attached.

Requires two repository secrets (Mozilla AMO API credentials from <https://addons.mozilla.org/developers/addon/api/key/>):
- `AMO_JWT_ISSUER`
- `AMO_JWT_SECRET`

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Login fails with "Serveur inaccessible" | Backend not running, or the prod backend hasn't been deployed with the extension-origin CORS support | Verify the backend is up and reachable at the URL you entered; ensure prod is on a build that includes `config/cors.ts` reflecting extension origins |
| Login fails with "Identifiants invalides" | Wrong email / password | Check credentials in the BattleCRM web app |
| Badge doesn't appear on LinkedIn | Content script not injected / LinkedIn DOM changed | `chrome://extensions` (or `about:addons`) → BattleCRM → check errors; reload the extension |
| Firefox: `.xpi` won't install | Unsigned build, or wrong file | Use the AMO-signed `.xpi` from a GitHub Release (option A), not a `.zip` |
| Chrome extension ID changed | `key` missing from the built manifest | The `key` in `wxt.config.ts` must be present at build time |

---

## Development mode (hot-reload)

```bash
pnpm dev:extension
```

WXT opens a Chromium dev window with the extension hot-loaded. The dev build's extension ID differs from the production build, but since the backend reflects any extension origin, no CORS change is needed to test against a local backend.
