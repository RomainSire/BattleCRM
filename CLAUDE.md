# BattleCRM — Guide pour Claude Code

> Ce fichier est la **source de vérité** pour tout agent travaillant sur ce repo, sans
> dépendre du contexte BMAD. Lis-le en entier avant de coder une feature.

## 1. Architecture du projet

Monorepo **pnpm** (workspaces) avec 3 applications et 1 package partagé :

```
battlecrm/
├── apps/
│   ├── backend/       # AdonisJS 6 (API REST, auth, BDD PostgreSQL)
│   ├── frontend/      # React 19 + Vite 8 (SPA)
│   └── extension/     # Extension Chrome (WXT + React)
├── packages/
│   └── shared/        # @battlecrm/shared — types TypeScript partagés (.d.ts only)
├── tests/
│   ├── e2e/           # Playwright (frontend) — projet chromium
│   └── e2e-extension/ # Playwright (extension) — projet extension
├── .brunoCollection/  # Collection HTTP Bruno (un dossier par ressource d'API)
├── docker-compose.yml # 3 services : postgres, backend, frontend
├── playwright.config.ts
└── biome.json         # Linter/formatter global (Biome v2)
```

Le `.env` est **à la racine du monorepo** (pas dans `apps/backend`). D'où le préfixe
`ENV_PATH=../../` obligatoire devant toute commande `node ace`.

### Backend (`apps/backend`)

- **Framework** : AdonisJS 6 + Lucid ORM v22 (PostgreSQL)
- **Auth** : Session native AdonisJS (scrypt, cookies httpOnly) — PAS Supabase
- **Validation** : VineJS v4 (`vine.create()`, pas `vine.compile()`)
- **Tests** : Japa (`tests/unit/`, `tests/functional/`)
- **Sérialisation JSON** : Lucid renvoie du **camelCase** par défaut (`funnelStageId`, pas `funnel_stage_id`)

Import aliases (définis dans `package.json#imports`) :
```
#controllers/*  #models/*  #serializers/*  #validators/*  #middleware/*
#mixins/*  #helpers/*  #services/*  #start/*  #database/*
```
⚠️ Utiliser `#start/kernel` (PAS `#kernel`).

**Modèles Lucid :** `User`, `FunnelStage`, `Prospect` (SoftDeletes), `ProspectStageTransition`,
`Positioning` (SoftDeletes), `ProspectPositioning`, `Interaction`, `Battle` (PAS de SoftDeletes).

**Couche par requête** : `Controller → Validator (Vine) → Model (Lucid) → Serializer → type @battlecrm/shared`.

### Frontend (`apps/frontend`)

- **React 19** + **Vite 8** + **TypeScript strict**
- **Routing** : React Router v7 (layout routes pour guards `AuthGuard`/`GuestGuard` via `<Outlet />`)
- **State serveur** : TanStack Query v5 (hooks `useX` dans `features/*/hooks/`, clés dans `lib/queryKeys.ts`)
- **Formulaires** : react-hook-form v7 + VineJS (validation côté client, schemas dans `features/*/schemas/`)
- **UI** : shadcn/ui (Radix) + Tailwind CSS v4
- **Drag & drop** : dnd-kit
- **i18n** : react-i18next — locales dans `apps/frontend/public/locales/{fr,en}.json`

Organisation **par feature** : `src/features/{auth,dashboard,prospects,positionings,interactions,settings}/`
avec sous-dossiers `components/`, `hooks/`, `lib/`, `schemas/`.

### Extension (`apps/extension`)

- **Framework** : [WXT](https://wxt.dev/) + React 19 + TypeScript
- **UI** : shadcn/ui + Tailwind via `@tailwindcss/postcss` (PAS `@tailwindcss/vite` — conflit Vite 7/8)
- **i18n** : react-i18next, locales `src/locales/{fr,en}.json`
- **Tests** : Vitest (unitaires) ; E2E via Playwright (`tests/e2e-extension/`)
- **`tsconfig.json` standalone** — NE PAS `extends: .wxt/tsconfig.json` (incompat Vite 7/esbuild)
- **`browser.*`** est auto-importé par WXT partout (pas d'import `webextension-polyfill`)
- **Auth** : tokens d'accès Bearer (SHA-256) — PAS les cookies de session
- **Entrypoint unique** : tout passe par `popup/` (pas de `chrome.windows.create`)
- Persistance d'état formulaire : `chrome.storage.session` (clé = URL LinkedIn normalisée)

### Package partagé (`packages/shared`)

Types TypeScript **uniquement** (`emitDeclarationOnly: true`), un fichier par entité dans
`src/types/`. **Toujours ajouter le type ici AVANT de coder le contrôleur backend.**

### Infrastructure

- PostgreSQL via Docker : `docker compose up postgres -d` (depuis la racine)
- Pas de RLS, pas de Supabase, pas de `DB_SSL`
- Sur un volume vierge : `cd apps/backend && ENV_PATH=../../ node ace migration:run`

---

## 2. Commandes essentielles

### Racine (monorepo)

```bash
pnpm dev                  # backend + frontend en parallèle (build shared d'abord)
pnpm build                # build toutes les apps
pnpm lint                 # Biome check (lecture seule)
pnpm format               # Biome check --write (auto-fix sûr)
pnpm lint:fix             # Biome check --write --unsafe
pnpm type-check           # build shared puis tsc --noEmit partout
pnpm test                 # tous les tests unitaires/fonctionnels (hors E2E)
pnpm test:e2e             # Playwright chromium      ⚠️ NE PAS lancer automatiquement
pnpm test:e2e:extension   # Playwright extension     ⚠️ NE PAS lancer automatiquement
pnpm shared:build         # build le package partagé
pnpm check:all            # lint + type-check + backend tests + build extension + E2E (CI complète)
```

### Backend (`apps/backend`) — préfixe `ENV_PATH=../../` obligatoire

```bash
ENV_PATH=../../ node ace serve --hmr           # dev hot reload
ENV_PATH=../../ node ace test                  # tous les tests Japa
ENV_PATH=../../ node ace test functional       # fonctionnels uniquement
ENV_PATH=../../ node ace test unit             # unitaires uniquement
ENV_PATH=../../ node ace test functional --files=X.spec.ts   # un seul fichier
ENV_PATH=../../ node ace migration:run         # appliquer les migrations
ENV_PATH=../../ node ace migration:rollback    # rollback (dev uniquement)
ENV_PATH=../../ node ace make:migration name   # créer une NOUVELLE migration
ENV_PATH=../../ node ace make:model name
ENV_PATH=../../ node ace make:controller name
```

### Frontend / Extension

```bash
pnpm --filter @battlecrm/frontend type-check
pnpm --filter @battlecrm/extension test          # Vitest (run)
pnpm --filter @battlecrm/extension type-check     # wxt prepare + tsc --noEmit
pnpm dev:extension                                # WXT dev (Chrome)
```

> Toujours passer par les scripts `package.json`. **Ne jamais** `npx <outil>` pour un outil
> déjà présent dans le workspace (biome, tsc, playwright, vitest, ace…).

---

## 3. Conventions de code

### Général

- **Linter/Formatter** : Biome v2 — PAS ESLint, PAS Prettier. Auto-fix : `pnpm format`.
- Biome trie les imports : packages `@`-scoped → aliases `#` → imports relatifs.
- **TypeScript strict** partout.

### Backend

- Type partagé dans `packages/shared/src/types/` **en premier**, puis serializer, puis contrôleur.
- Toujours un `serializeX()` dans `app/serializers/` retournant le type partagé.
- **Isolation par user** : TOUTE requête sur une ressource utilise le scope `forUser(userId)`.
  C'est le mécanisme de sécurité central — ne jamais l'oublier.
- **Champs nullable** : assigner explicitement (`model.field = payload.field ?? null`) — jamais `undefined`.
- **UUID en query/param** : valider avec `UUID_REGEX` (`#helpers/regex`) avant de passer à Lucid sur
  une colonne UUID (sinon PostgreSQL → 500). En **param de route**, préférer `.where('id', UUID_REGEX)`
  (un id non-UUID renvoie alors 404, pas besoin de check manuel dans le contrôleur).
- **`withCount()`** : résultat dans `$extras`, mapper avec `Number($extras.count ?? 0)`.
- **SoftDeletes + sous-ressources** : `.withTrashed()` quand un parent archivé doit rester accessible.
- Conventions HTTP : `response.ok({ message })` pour un DELETE, `response.created(...)` pour un POST,
  `response.notFound/unprocessableEntity/conflict/badRequest` pour les erreurs métier.

### Frontend

- **HTML sémantique** : `<main>`, `<header>`, `<section>`, `<nav>` plutôt que `<div>` générique.
- **Toujours** préférer les composants shadcn aux éléments HTML bruts.
- **Formulaires** : `Label` (shadcn) + `FieldError` (de `@/components/ui/field`) ; phone input via
  `Controller` (pas `register`), `defaultCountry="FR"`, format E.164.
- `SelectTrigger` nécessite `className="w-full"` pour s'étirer.
- `credentials: 'include'` sur **tous** les `fetch` (cookies de session) — utiliser `fetchApi` de `@/lib/api`.
- Types API importés depuis `@battlecrm/shared` directement (pas de ré-export par feature).
- Réponses Lucid en **camelCase** (`funnelStageId`).
- shadcn Tooltip ne se déclenche pas sur un bouton `disabled` → wrapper le bouton dans un `<span>`.

### Extension

- Tailwind via `@tailwindcss/postcss` ; `tsconfig.json` standalone ; `browser.*` auto-importé.
- Auth Bearer (tokens SHA-256), pas de cookies de session.
- État formulaire persisté via `chrome.storage.session` (clé = URL LinkedIn normalisée), flushé au
  changement de profil. Types API depuis `@battlecrm/shared`.

---

## 4. Ce qu'il FAUT faire (workflow par dev)

Pour **chaque** feature/fix, l'agent doit, dans cet ordre :

1. **Comprendre l'existant d'abord** — lire le code réel concerné avant d'écrire quoi que ce soit.
2. **Type partagé** : ajouter/mettre à jour le type dans `packages/shared/src/types/` AVANT le backend.
3. **TDD red-green-refactor** : écrire le test qui échoue **d'abord**, puis l'implémentation.
4. **Tests adéquats et réels** :
   - Backend → Japa fonctionnels dans `apps/backend/tests/functional/<ressource>/` (auth, happy path,
     règles métier, ownership/isolation user, 404/422). Tests d'**intégration réels** : `loginAs(user)`,
     **jamais** de mock de la BDD.
   - Logique pure → Japa unitaires (`tests/unit/`). Extension → Vitest.
   - Parcours utilisateur critique → Playwright E2E (`tests/e2e/`), **à écrire** mais **pas à lancer**
     automatiquement (lent — demander à Romain de les lancer).
5. **Mettre à jour la collection Bruno** : pour tout nouvel endpoint ou endpoint modifié, ajouter/éditer
   le `.bru` dans `.brunoCollection/<ressource>/` (incrémenter le `seq`, suivre le format des fichiers voisins).
6. **i18n** : toute string UI ajoutée doit l'être dans **`fr.json` ET `en.json`** (frontend et/ou extension).
7. **Sérialiseur** : tout nouveau champ exposé passe par `serializeX()`.
8. **Validation finale obligatoire avant de rendre la main** :
   `pnpm lint` → propre, `pnpm type-check` → 0 erreur, et la suite de tests concernée **verte à 100%**
   (`ENV_PATH=../../ node ace test functional` pour le backend). 0 régression.
9. **Documenter** brièvement ce qui a été fait et les fichiers touchés dans la réponse.

---

## 5. Ce que l'agent NE PEUT PAS faire

- **Ne jamais committer ni push** — c'est **toujours** Romain qui s'en charge. L'agent peut préparer/stager
  et décrire le travail, mais `git commit` / `git push` sont interdits sauf demande explicite et ponctuelle.
  Jamais de `git push --force` sans confirmation.
- **Ne jamais modifier une migration existante** (`apps/backend/database/migrations/00XX_*.ts` déjà
  appliquée). Pour tout changement de schéma → **créer une NOUVELLE migration** numérotée à la suite
  (`make:migration`). Les migrations passées sont immuables.
- **Ne jamais installer/ajouter/mettre à jour une dépendance** (`pnpm add`, bump de version, nouveau package)
  **sans demander** l'accord de Romain au préalable.
- **Ne jamais lancer les tests E2E automatiquement** (Playwright) — trop lents, les demander à Romain.
- **Ne pas mentir sur les tests** : ils doivent réellement exister et passer à 100%.
- **Ne pas** utiliser Supabase (Auth SDK, RLS) ni `DB_SSL`.
- **Ne pas** utiliser ESLint ni Prettier — Biome v2 uniquement.
- **Ne pas** oublier `ENV_PATH=../../` devant les commandes `node ace`.
- **Ne pas** utiliser `npx` pour un outil déjà dans le workspace.
- **Ne pas** mocker la BDD dans les tests fonctionnels (intégration réelle obligatoire).
- **Ne pas** passer un UUID non validé à Lucid `.where()` sur une colonne UUID (erreur 500).
- **Ne pas** oublier `.withTrashed()` quand un endpoint de sous-ressource doit atteindre un parent archivé.
- **Ne pas** supprimer/écraser un fichier qu'on n'a pas créé sans avoir vérifié son contenu d'abord.

---

## 6. Contexte métier

**BattleCRM** est un CRM personnel pour la **recherche d'emploi** avec des capacités d'**A/B testing**
(les « Battles »).

### Concept clé : le « Battle »

L'utilisateur teste différentes **Positionings** (façons de se présenter : titre, message, angle) auprès
de ses **Prospects** (contacts professionnels). Il mesure quel Positioning génère le plus d'interactions
positives. Le « Battle » est le mécanisme central de comparaison entre deux variantes pour une étape du funnel.

### Entités principales

| Entité | Rôle |
|---|---|
| `User` | Propriétaire de toutes les données (isolation totale par user via scope `forUser`) |
| `FunnelStage` | Étape du funnel (ex : « Cible », « Contacté », « Entretien »), ordonnée par `position` |
| `Prospect` | Contact LinkedIn/email à cibler (SoftDeletes pour archivage) |
| `ProspectStageTransition` | Historique des changements d'étape d'un prospect |
| `Positioning` | Variante de présentation à tester (SoftDeletes) |
| `ProspectPositioning` | Jonction Prospect ↔ Positioning avec `outcome` (`pending`/`success`/`failure`) |
| `Interaction` | Log d'une interaction avec un prospect |
| `Battle` | Comparaison A/B de deux Positionings sur un stage. `status` = `active`/`closed`. PAS de SoftDeletes. |

### Règles Battle

- Une seule battle **active** par `(user, funnel_stage)` — contrainte unique partielle en DB.
- `battleNumber` = `MAX(battle_number)+1` par `(user, stage)`, calculé applicativement (pas de séquence).
- **Clôturer** une battle (`PATCH /battles/:id/close`) désigne un gagnant (`winnerId`, `status='closed'`),
  bloqué tant que le feu est rouge (données insuffisantes, n<10/variant — voir `bayesian_service`/`trafficLight`).
- **Annuler** une battle (`DELETE /battles/:id`) supprime physiquement une battle active sans gagnant,
  libérant son `battleNumber`. Possible à tout moment.

### Signal de succès

`prospect_positionings.outcome = 'success'` est **le signal métier clé** indiquant qu'un Positioning a
fonctionné avec un Prospect. (L'ancien `interaction.status` a été supprimé en migration `0010`.)

### Extension Chrome

Capture des prospects directement depuis LinkedIn. Entrypoint unique `popup/`. État de formulaire persisté
via `chrome.storage.session` pour survivre au close/reopen du popup.
