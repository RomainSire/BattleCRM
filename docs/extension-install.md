# BattleCRM Browser Extension — Installation Guide

## Overview

The BattleCRM extension detects LinkedIn profiles and lets you add or update prospects in BattleCRM without leaving the browser. It uses a Bearer token auth separate from the web app session.

**Supported browsers:** Chrome / Chromium (MV3) · Firefox (MV2)

---

## Prerequisites

- Node.js ≥ 20 and pnpm installed
- BattleCRM repository cloned and dependencies installed (`pnpm install` at the root)
- A running BattleCRM backend (local or remote)

---

## 1. Build from source

Run from the **repository root**:

```bash
# Chrome / Chromium (Manifest V3)
pnpm build:extension

# Firefox (Manifest V2)
pnpm --filter @battlecrm/extension build:firefox
```

Build outputs:
| Browser | Output directory |
|---------|-----------------|
| Chrome | `apps/extension/.output/chrome-mv3/` |
| Firefox | `apps/extension/.output/firefox-mv2/` |

> The build is deterministic. The `key` field in `wxt.config.ts` pins the Chrome extension ID across builds — you never need to update `EXTENSION_ORIGINS` after the first setup.

---

## 2. Load on Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the folder `apps/extension/.output/chrome-mv3/`
5. The **BattleCRM** extension appears in your extensions list

**Find the extension ID:**
Still on `chrome://extensions`, the ID is displayed under the extension name (32-character string like `abcdefghijklmnopqrstuvwxyz123456`).

> The ID is stable across builds thanks to the fixed `key` in the manifest. Note it — you will need it for the backend CORS configuration (step 4).

---

## 3. Load on Firefox

Firefox only supports temporarily loaded extensions (until browser restart) unless the extension is signed.

1. Open `about:debugging`
2. Click **This Firefox** in the left sidebar
3. Click **Load Temporary Add-on...**
4. Navigate to `apps/extension/.output/firefox-mv2/` and select `manifest.json`
5. The extension appears in the list with a temporary UUID

**Find the extension UUID:**
On `about:debugging`, click **Inspect** on the BattleCRM extension. The internal UUID is shown in the URL (`moz-extension://<uuid>/`).

> Firefox UUIDs change on each browser restart for temporary add-ons. To keep a stable UUID, set a fixed `extensions.webextensions.uuids` preference in `about:config` or distribute a signed `.xpi`.

---

## 4. Configure `EXTENSION_ORIGINS` in `.env`

The backend needs to allow cross-origin requests from the extension. Add the extension origins to the root `.env`:

```dotenv
# Chrome only
EXTENSION_ORIGINS=chrome-extension://abcdefghijklmnopqrstuvwxyz123456

# Chrome + Firefox
EXTENSION_ORIGINS=chrome-extension://abcdefghijklmnopqrstuvwxyz123456,moz-extension://your-firefox-uuid-here
```

Replace the placeholders with the IDs found in steps 2 and 3.

**Restart the backend** after changing `.env` so the new CORS origins take effect:

```bash
# Local dev
cd apps/backend && ENV_PATH=../../ node ace serve --hmr

# Docker
docker compose restart backend
```

---

## 5. First use

1. Open a LinkedIn profile page (e.g. `linkedin.com/in/someone`)
2. Click the **BattleCRM** icon in your browser toolbar
3. A login form appears — fill in:
   - **URL BattleCRM**: the base URL of your backend, without trailing slash  
     Examples: `http://localhost:3333` · `https://battlecrm.yourdomain.com`
   - **Email** and **Password**: your BattleCRM account credentials
4. Click **Se connecter**

On success, the popup shows either:
- A **green badge** — the profile is already in BattleCRM (click to view/edit)
- A **red badge** — new profile — a pre-filled form lets you add it as a prospect

> Credentials (token + base URL) are stored in `chrome.storage.local` and persist across browser sessions. Form state for the current LinkedIn profile is cached in `chrome.storage.session` and survives popup close/reopen.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Login fails with "Serveur inaccessible" | CORS not configured or backend not running | Check `EXTENSION_ORIGINS` in `.env` and restart backend |
| Login fails with "Identifiants invalides" | Wrong email / password | Check credentials in BattleCRM web app |
| Badge doesn't appear on LinkedIn | LinkedIn DOM changed / content script not injected | Check `chrome://extensions` → BattleCRM → Errors; reload the extension |
| Extension ID changed (Chrome) | `key` field missing from built manifest | The `key` in `wxt.config.ts` must be present at build time |
| Firefox UUID changed after restart | Temporary add-on limitation | Reload the add-on and update `EXTENSION_ORIGINS` if needed |

---

## Development mode

To run the extension with hot-reload during development:

```bash
pnpm dev:extension
```

WXT opens a browser window automatically with the extension loaded. In dev mode the extension ID may differ from the production build — update `EXTENSION_ORIGINS` accordingly if testing against a local backend.
