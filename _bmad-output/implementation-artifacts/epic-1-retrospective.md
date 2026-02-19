# Rétrospective — Epic 1 : Project Foundation & Authentication

**Date :** 2026-02-20
**Facilitateur :** Bob (Scrum Master Agent)
**Participant :** Romain (Développeur)
**Epic :** Epic 1 — Project Foundation & Authentication (8 stories)

---

## 📊 Résultats chiffrés

| Indicateur | Résultat |
|-----------|---------|
| Stories complétées | **8/8** ✅ |
| Période | 2026-02-04 → 2026-02-20 |
| FRs couverts | FR51–FR56 (auth + isolation) |
| Tests backend | 0 → **21 fonctionnels + 4 unitaires** |
| Tests frontend | 0 (identifié comme action item) |
| Code reviews adversariales | **8** (une par story) |

---

## 🏆 Ce qui a bien marché

### 1. Code Review adversariale — indispensable
Le processus de code review systématique (minimum 3–10 problèmes par story) a attrapé des bugs significatifs à chaque itération. Exemples concrets :
- Story 1-8 : 7 problèmes trouvés — healthcheck `wget` cassé sur Alpine BusyBox, secrets dans build layer, `USER node` manquant, `depends_on` sans `condition: service_healthy`, dead code `.dockerignore` dans sous-dossiers
- Story 1-6 : gestion d'erreurs insuffisante (catch trop large, re-throw manquant)
- Story 1-5 : `#kernel` alias inexistant détecté avant le runtime

Sans ce processus, plusieurs bugs auraient atteint la production.

### 2. SM Context Analysis de plus en plus précise
À partir de Story 1-6/1-7, les sections "Previous Story Intelligence" dans les story files sont devenues suffisamment riches pour prévenir les erreurs récurrentes :
- `ENV_PATH=../../` systématiquement documenté
- `npm install --omit=dev` vs `npm ci` (pas de `package-lock.json` dans `ace build`)
- `assertCookieMissing` ne fonctionne pas pour les sessions AdonisJS
- La découverte de Story 1-7 (la majorité du code existait déjà depuis la code review 1-5) a économisé du temps de dev inutile.

### 3. Foundation technique solide et cohérente
- Session auth AdonisJS (scrypt + httpOnly cookies) — robuste et bien intégré
- VineJS validation backend + frontend avec messages d'erreur i18n
- TanStack Query pour tout l'état serveur (invalidation, setQueryData)
- React Router v7 avec layout guards (AuthGuard/GuestGuard via Outlet)
- Biome v2 pour linting/formatting sans configuration complexe

### 4. Croissance de la couverture de test
21 tests fonctionnels backend qui couvrent les edge cases réels (sessions expirées, double registration, registration désactivée, logout sans session, etc.).

---

## ⚠️ Ce qui a posé problème

### 1. Pivot architectural en plein milieu d'épic (Story 1-4) ⚠️ MAJEUR
**Problème :** La découverte que Supabase Auth est incompatible avec la session auth native AdonisJS (JWT vs cookies) a forcé un changement d'architecture complet.

**Impact :** Le cleanup a s'est étalé sur 5 stories (1-4 → 1-8) : suppression de la migration RLS, du middleware RLS, du `DB_SSL`, de `db_dev/`, mise à jour de `.env.example`, correction dans `database.ts`, `env.ts`, `kernel.ts`.

**Root cause :** `architecture.md` mentionnait Supabase (pour la DB hébergée) sans valider que le SDK Supabase Auth est incompatible avec la session auth AdonisJS native. Le choix technologique n'a pas été testé ensemble avant d'être documenté.

**Correction apportée :** `epics.md` mis à jour — FR56 et Story 2.1 AC corrigés pour refléter l'architecture actuelle (plain PostgreSQL + `forUser()` scope, pas de RLS).

### 2. Outillage monorepo découvert story par story
Plusieurs patterns critiques ont été découverts tardivement :
- `ENV_PATH=../../` — découvert Story 1-3, documenté mais re-découvert en Story 1-4
- `npm install --omit=dev` vs `npm ci` — découvert Story 1-8 (pas de `package-lock.json` dans output `ace build`)
- Root `.dockerignore` seul effectif quand `context: .` — découvert Story 1-8
- `#kernel` alias inexistant — découvert Story 1-5 (utiliser `#start/kernel`)
- `--hmr` vs `--watch` pour Adonis serve — découvert Story 1-3

Ces patterns auraient dû être documentés dans Story 1-3 (scaffold backend) plutôt que découverts progressivement.

### 3. Scope creep silencieux (logout ajouté prématurément)
Le logout a été ajouté lors de la code review de Story 1-5 (pre-emptive), rendant Story 1-7 beaucoup plus petite qu'anticipé. Ce n'est pas mauvais en soi (livraison rapide), mais crée de l'opacité dans le suivi du sprint.

### 4. Zéro tests frontend
Les tests backend (Japa) couvrent bien la logique API. Mais aucun test frontend n'existe. Le bug de redirect loop (Story 1-7 : `invalidateQueries` → `setQueryData(null)`) a été découvert manuellement. Des tests E2E auraient pu l'attraper automatiquement.

---

## 🔭 Impact sur Epic 2 (Funnel Configuration)

### Corrections apportées immédiatement

`epics.md` mis à jour :
- **FR56** : "Row Level Security" → "application-level user isolation via `forUser()` query scope"
- **Story 2.1 AC** : "Row Level Security is enabled" → "`forUser(userId)` query scope implementé sur FunnelStage model"

### Points d'attention pour Epic 2

1. **Seeding de données à la création de compte** (Story 2.1) — 10 stages par défaut par utilisateur → hook AdonisJS `afterCreate` sur User model ou appel de service dans `AuthController.register`. Décision architecturale à prendre lors de la création du story file.

2. **Drag-and-drop de réordonnancement** (Story 2.3) — Librairie choisie : **dnd-kit** (maintenue activement, légère, accessible). À documenter dans le story file.

3. **Gestion des positions** (Story 2.2 + 2.4) — L'endpoint `PUT /api/funnel_stages/reorder` doit gérer les conflits de position (contrainte unique sur `user_id, position`). Utiliser une transaction et réassigner toutes les positions en une fois.

---

## 💡 Action Items

| # | Action | Priorité | Statut |
|---|--------|---------|--------|
| A1 | ~~Corriger `epics.md` : FR56 + Story 2.1 AC (RLS → forUser())~~ | Haute | ✅ Fait |
| A2 | Mettre en place Playwright pour les tests E2E frontend avant/pendant Epic 2 | Haute | ⏳ À faire |
| A3 | Utiliser le workflow BMAD `testarch-framework` pour scaffolder Playwright | Haute | ⏳ À faire |
| A4 | Documenter dnd-kit comme choix de librairie dans Story 2.3 | Moyenne | ⏳ À faire (lors création story) |

### Décision sur les tests frontend

**Recommandation adoptée :** Playwright uniquement dans un premier temps.

**Pourquoi Playwright plutôt que Vitest + RTL :**
- BattleCRM est un CRM CRUD — la logique complexe vit dans le backend, pas dans les composants
- Playwright teste les vrais parcours utilisateur (auth, navigation, formulaires) contre un vrai serveur
- Un test Playwright remplace 5–10 tests RTL + mocks MSW
- Les bugs critiques (redirect loop, session expirée) sont des bugs d'intégration, pas des bugs de composant

**Vitest + RTL** : différé. À reconsidérer si des hooks complexes apparaissent (ex: logique Bayésienne Epic 7).

**Timing :** Scaffolding Playwright à réaliser avant ou en début d'Epic 2, via le workflow `testarch-framework`.

---

## 📝 Décisions architecturales confirmées pour la suite

| Décision | Détail |
|---------|--------|
| Auth | AdonisJS session auth (scrypt + httpOnly cookies) — NE PAS utiliser Supabase Auth SDK |
| DB | Plain PostgreSQL (Docker), pas Supabase — pas de RLS, pas de JWT Supabase |
| Isolation | `forUser(userId)` query scope sur chaque modèle Lucid |
| Frontend state | TanStack Query pour tout l'état serveur |
| Linting | Biome v2 (pnpm biome check --write .) |
| Tests backend | Japa (fonctionnels + unitaires) |
| Tests frontend | Playwright E2E (à scaffolder — action item A2/A3) |
| Drag-and-drop | dnd-kit (Epic 2 Story 2.3) |

---

*Rétrospective générée par Bob (SM Agent, Claude Sonnet 4.6) — 2026-02-20*
