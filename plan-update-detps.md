# Plan de montée de dépendances

_Généré le 2026-05-16 — 29 packages à mettre à jour_

Stratégie : du plus safe au plus risqué. Chaque groupe se valide avant de passer au suivant.

---

## Groupe 1 — Tooling / types patchs (risque nul)

Tout en `devDependencies`, aucun impact runtime. Une seule passe.

**Commandes :**
```bash
pnpm update @biomejs/biome @swc/core @types/jsdom @vitejs/plugin-react postcss typescript vite vitest wxt --recursive
```

**Vérification :**
```bash
pnpm lint && pnpm type-check
```

| Package | Actuel | Cible | Status |
|---|---|---|---|
| `@biomejs/biome` (root) | 2.4.12 | 2.4.15 | ✅ |
| `@swc/core` (backend) | 1.15.26 | 1.15.33 | ✅ |
| `@types/jsdom` (extension) | 28.0.1 | 28.0.3 | ✅ |
| `@vitejs/plugin-react` (frontend) | 6.0.1 | 6.0.2 | ✅ |
| `postcss` (extension) | 8.5.10 | 8.5.14 | ✅ |
| `typescript` (root) | 6.0.2 | 6.0.3 | ✅ |
| `vite` (frontend + extension) | 8.0.8 | 8.0.13 | ✅ |
| `vitest` (extension) | 4.1.5 | 4.1.6 | ✅ |
| `wxt` (extension) | 0.20.22 | 0.20.26 | ✅ |

---

## Groupe 2 — Patchs runtime + Playwright (très safe)

**Commandes :**
```bash
pnpm update @adonisjs/core react react-dom @playwright/test --recursive
```

**Vérification :**
```bash
# Backend unit + functional
cd apps/backend && ENV_PATH=../../ node ace test unit && ENV_PATH=../../ node ace test functional
# E2E
pnpm test:e2e
```

| Package | Actuel | Cible | Notes | Status |
|---|---|---|---|---|
| `@adonisjs/core` (backend) | 7.3.1 | 7.3.2 | Patch bugfix | ✅ |
| `react` + `react-dom` (frontend + extension) | 19.2.5 | 19.2.6 | Patch bugfix | ✅ |
| `@playwright/test` (root) | 1.59.1 | 1.60.0 | Minor — browser binaries à re-télécharger (`pnpm exec playwright install`) | ✅ |

---

## Groupe 3a — Tailwind (faire ensemble, versions liées)

Les trois packages `tailwindcss` / `@tailwindcss/vite` / `@tailwindcss/postcss` ont des versions couplées — toujours les mettre à jour en même temps.

**Changements 4.2.2 → 4.3.0 :**
- ✅ Nouvelles utilitaires addatives : `scrollbar-*`, `scrollbar-gutter-*`, `zoom-*`, `tab-*`, `@container-size`
- ⚠️ `start-*` / `end-*` dépréciés → `inset-s-*` / `inset-e-*` (pas forced, pas cassant immédiatement)
- ✅ Amélioration de la canonicalisation CSS (arbitrary values, `:has()` variants)
- ⚠️ Un breaking change non spécifié dans la release — vérification visuelle obligatoire

**Commandes :**
```bash
pnpm update tailwindcss @tailwindcss/vite @tailwindcss/postcss tailwind-merge --recursive
```

**Vérification :** Lancer les deux devservers, inspecter visuellement les pages principales (login, dashboard, kanban, analytics). Vérifier les classes Tailwind arbitraires dans le code si des styles semblent cassés.

| Package | Actuel | Cible | Status |
|---|---|---|---|
| `tailwindcss` (frontend) | 4.2.2 | 4.3.0 | ✅ |
| `tailwindcss` dev (extension) | 4.2.2 | 4.3.0 | ✅ |
| `@tailwindcss/vite` (frontend) | 4.2.2 | 4.3.0 | ✅ |
| `@tailwindcss/postcss` dev (extension) | 4.2.2 | 4.3.0 | ✅ |
| `tailwind-merge` (frontend + extension) | 3.5.0 | 3.6.0 | ✅ |

---

## Groupe 3b — React ecosystem

**Commandes :**
```bash
pnpm update react-hook-form react-router lucide-react --recursive
```

**Vérification :** `pnpm type-check`, tester les formulaires (login, create prospect, etc.) et la navigation.

| Package | Actuel | Cible | Notes | Status |
|---|---|---|---|---|
| `react-hook-form` (frontend + extension) | 7.72.1 | 7.76.0 | Aucun breaking change notable entre ces versions | ✅ |
| `react-router` (frontend) | 7.14.1 | 7.15.1 | APIs `unstable_*` stabilisées (ex: `unstable_mask` → `mask`). Ne casse que si on utilisait ces APIs expérimentales — notre usage est standard (`<Outlet />`, guards), donc safe | ✅ |
| `lucide-react` (frontend + extension) | 1.8.0 | 1.16.0 | Icons additives. Certaines icônes peuvent être renommées entre 8 et 16 mineurs — faire `pnpm type-check` pour détecter | ✅ |

---

## Groupe 3c — i18n (faire ensemble, versions liées)

**Commandes :**
```bash
pnpm update i18next react-i18next --recursive
```

**Vérification :** Tester l'extension et le frontend en FR et EN.

| Package | Actuel | Cible | Notes | Status |
|---|---|---|---|---|
| `i18next` (frontend + extension) | 26.0.5 | 26.2.0 | Minor bugfixes | ✅ |
| `react-i18next` (frontend + extension) | 17.0.3 | 17.0.8 | Minor patches | ✅ |

---

## Groupe 3d — TanStack Query + VineJS

**Commandes :**
```bash
pnpm update @tanstack/react-query @tanstack/react-query-devtools @vinejs/vine --recursive
```

**Vérification :** `pnpm type-check`, tester les mutations frontend (create/update prospect, etc.). Pour VineJS, vérifier que les validations backend passent avec `pnpm test`.

| Package | Actuel | Cible | Notes | Status |
|---|---|---|---|---|
| `@tanstack/react-query` (frontend + extension) | 5.99.0 | 5.100.10 | Patches only, aucun breaking change | ✅ |
| `@tanstack/react-query-devtools` (frontend) | 5.99.0 | 5.100.10 | Idem | ✅ |
| `@vinejs/vine` (backend + frontend) | 4.3.1 | 4.4.0 | Additive : `vine.create()`, `partial()`, global date transforms. Aucun breaking change | ✅ |

---

## Groupe 3e — shadcn CLI

shadcn est un CLI de génération de composants, pas une librairie runtime. L'update ne modifie pas les composants déjà générés dans `src/components/ui/`.

**Commandes :**
```bash
pnpm update shadcn --recursive
```

**Vérification :** `pnpm type-check`. Pas de vérification runtime nécessaire.

| Package | Actuel | Cible | Notes | Status |
|---|---|---|---|---|
| `shadcn` (frontend + extension) | 4.2.0 | 4.7.0 | CLI seulement — les composants générés sont inchangés | ✅ |

---

## Groupe 4 — Majeurs (lire les notes avant d'appliquer)

### 4a — `i18next-http-backend` 3.0.4 → 4.0.0

**Breaking changes :**
- **`cross-fetch` retiré** — la lib n'inclut plus de polyfill fetch. Elle s'appuie sur le fetch natif du runtime.
- **Node.js 18+ requis** (était moins restrictif avant).

**Impact sur BattleCRM :**
- Le projet tourne sur Node ≥18 (AdonisJS 6 le requiert). ✅
- `i18next-http-backend` est utilisé dans le **frontend** (`apps/frontend`) pour charger les traductions via HTTP — le navigateur a `fetch` natif. ✅
- Vérifier qu'aucune config n'injectait un `alternateFetch` ou `cross-fetch` dans `i18n.ts`.

**Avant d'appliquer :** Grep pour `cross-fetch` ou `alternateFetch` dans le projet :
```bash
grep -r "cross-fetch\|alternateFetch" apps/ packages/
```

**Commandes :**
```bash
pnpm update i18next-http-backend --recursive
```

**Vérification :** Tester le chargement des traductions en FR et EN dans le frontend. Ouvrir la console navigateur — aucune erreur fetch.

| Package | Actuel | Cible | Status |
|---|---|---|---|
| `i18next-http-backend` (frontend) | 3.0.4 | 4.0.0 | ✅ |

---

### 4b — `@types/node` 24.12.2 → 25.8.0

**Contexte :** Ce package est `devDependency` — on met à jour les *types* TypeScript, pas le runtime Node.js. Le risque réel est d'obtenir des erreurs `type-check` si le code utilise des APIs retirées dans Node 25.

**APIs retirées dans Node.js 25 (source : release notes officielles) :**
| API retirée | Remplaçant |
|---|---|
| `SlowBuffer` | `Buffer.allocUnsafe()` |
| `fs.rmdir(path, { recursive: true })` | `fs.rm(path, { recursive: true })` |
| `assert.fail(msg, actual, expected)` (3 args) | `assert.fail(msg)` ou `new AssertionError()` |
| `fs.F_OK`, `fs.R_OK`, `fs.W_OK`, `fs.X_OK` (root) | `fs.constants.F_OK`, etc. |
| `Module._debug` | Debugger natif Node.js |
| Callback dans `worker.terminate(cb)` | Utiliser la Promise retournée |

**Impact probable :** Faible — AdonisJS et les libs utilisées sont à jour. Mais grep préventif recommandé :
```bash
grep -r "SlowBuffer\|fs\.F_OK\|fs\.R_OK\|fs\.W_OK\|fs\.X_OK\|Module\._debug" apps/ packages/
```

**Commandes :**
```bash
pnpm update @types/node --recursive
```

**Vérification :** `pnpm type-check` dans tous les workspaces. Toute erreur indique une API dépréciée à corriger.

| Package | Actuel | Cible | Status |
|---|---|---|---|
| `@types/node` (backend + frontend + root) | 24.12.2 | 25.8.0 | ✅ |

---

## Récapitulatif

| Groupe | Packages | Risque | Status |
|---|---|---|---|
| G1 — Tooling patchs | 9 packages | 🟢 Nul | ✅ |
| G2 — Runtime patchs | 3 packages | 🟢 Très faible | ✅ |
| G3a — Tailwind | 5 packages | 🟡 Faible (vérif visuelle) | ✅ |
| G3b — React ecosystem | 3 packages | 🟡 Faible | ✅ |
| G3c — i18n | 2 packages | 🟢 Faible | ✅ |
| G3d — TanStack + Vine | 3 packages | 🟢 Faible | ✅ |
| G3e — shadcn CLI | 1 package | 🟢 Nul | ✅ |
| G4a — i18next-http-backend | 1 package | 🟠 Moyen (grep avant) | ✅ |
| G4b — @types/node | 1 package | 🟠 Moyen (type-check après) | ✅ |
