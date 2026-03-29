# Rétrospective — Epic 5B : Prospect-Positioning Assignment

**Date :** 2026-03-28
**Facilitateur :** Bob (Scrum Master Agent)
**Participant :** Romain (Project Lead)
**Epic :** Epic 5B — Prospect-Positioning Assignment (Refacto Modèle) — 3 stories

---

## Résultats chiffrés

| Indicateur | Résultat |
|-----------|---------|
| Stories complétées | **3/3** |
| Stories | 5B.1 (Schema) → 5B.2 (API) → 5B.3 (Frontend) |
| Tests fonctionnels | 218 → 242 → 245 (progression régulière, 0 régression) |
| Tests E2E Playwright | 10 nouveaux tests (AC1–AC6) |
| Bloqueurs majeurs | 0 |
| Incidents de production | 0 |
| Dette technique critique | 0 |
| Nature de l'epic | Refacto architecturale profonde + feature complète |

---

## Contexte — Pourquoi cet epic a émergé

Epic 5B n'était pas planifié dans la roadmap initiale. Il a émergé après la retro Epic 5 : le modèle de données `prospects.positioning_id` était fondamentalement faux — un prospect n'a pas *un* positioning fixe, il a un positioning par stage de funnel, avec un outcome explicite.

Romain a investi un effort significatif (hors IA) pour modéliser le résultat souhaité et le schéma de données nécessaire. La décision a été courageuse : plutôt que de patcher la surface, reconstruire sur des bases saines avant d'attaquer les analytics (Epic 6).

---

## Suivi des Action Items Epic 5

| # | Action | Statut |
|---|--------|--------|
| A1 | Investigation TanStack Query cache — staleTime + invalidation | ❌ Non adressé (5B intercalé de façon non planifiée) |
| A2 | Envisager Zustand pour funnel stages | ❌ Non adressé |
| A3 | Vérifier couverture E2E après parallélisation | ✅ Partiellement — 10 nouveaux tests E2E ajoutés et stables |
| A4 | Scaffolder contexte Playwright pour extension Chromium | ⏳ Prévu pendant Epic 7 |
| A5 | Documenter token auth extension dans architecture.md | ⏳ Prévu pendant Epic 7 |

A1 et A2 restent valides — à traiter avant ou pendant Epic 7.

---

## Ce qui a bien marché

### 1. Architecture junction table — propre et scalable

La modélisation `prospect_positionings` avec outcome explicite et sans lifecycle temporel a tenu sous la pression de la Story 5B.3. Tous les cas edge (archivage, changement de stage, popup race condition) se sont résolus naturellement dans ce modèle.

**Décision clé :** le positionnement "actif" est dérivé (`pp.funnel_stage_id === prospect.funnel_stage_id`), pas stocké. Élégant, sans ambiguïté, sans état à synchroniser.

### 2. Progression test count — 0 régression

218 → 242 → 245 tests fonctionnels. Chaque story a ajouté ses tests sans casser les précédents. Signe de design stable.

### 3. Code review adversarial — problèmes rattrapés avant merge

Plusieurs issues non triviales détectées pendant le process :
- `popupTitle` manquant dans ProspectDetail (présent dans KanbanView mais oublié dans le détail)
- Race condition de la popup (TanStack Query refetch efface `activePositioning` avant que l'utilisateur clique)
- AC9 (historique des positionnements) absent de la spec initiale — ajouté lors de la review
- AC3 UX : bouton "Edit" collapsé bien plus UX-friendly que les 3 boutons toujours visibles

### 4. Batch loading activePositioning — pas de N+1

`ProspectsController.index()` charge tous les `prospect_positionings` en une seule query supplémentaire, filtrée en mémoire. Le Kanban avec 50 cartes ne fait pas 50 appels API. Pattern documenté dans les Dev Notes.

### 5. Découverte lucide-react v0.563 documentée

`AlertCircle` renommé en `CircleAlert` → classe SVG `lucide-circle-alert`. Non évident depuis la doc. Découvert via E2E, documenté dans les Completion Notes pour les prochains epics.

### 6. Connexion complète de la chaîne produit

Prospect → Funnel Stage → Positioning → Outcome. Tout est traçable, tout est cohérent. `prospect_positionings.outcome = 'success'` est maintenant le signal de conversion sur lequel Epic 6 (Battle Analytics) s'appuiera.

---

## Ce qui a posé problème

### 1. Race condition popup AC4 — pattern TanStack Query à retenir

Après un changement de stage, TanStack Query refetch les prospects → `prospect.activePositioning` devient `null` pour la nouvelle stage → la popup disparaissait avant que l'utilisateur puisse cliquer.

**Solution :** capturer `outcomePositioningName` et `outcomeTargetStageName` au moment d'*ouvrir* la popup (pas de les lire depuis le prospect live). Pattern robuste.

**Leçon :** la réactivité de TanStack Query peut "effacer" du state UI utile pendant un refetch. À anticiper dans tout composant qui affiche une UI conditionnelle basée sur des données serveur et qui attend une interaction utilisateur.

### 2. FK oubliée dans `hardResetTestData`

`prospect_positionings` a une FK vers `prospects`. Le endpoint de reset supprimait les prospects avant les positionings → crash FK. Non détecté jusqu'aux E2E.

**Leçon :** toute nouvelle junction table avec FK vers `prospects` ou `positionings` doit être ajoutée à l'ordre de suppression dans `test_controller.ts`. Checklist à tenir à jour.

### 3. Ambiguïté DOM — deux boutons "Edit" même nom accessible

ProspectDetail ("Edit prospect") et PositioningSection ("Edit outcome") ont le même nom accessible "Edit". Playwright ne peut pas les distinguer. Résolu avec `data-testid="positioning-edit-btn"`.

**Leçon :** quand deux boutons dans la même vue ont le même nom accessible, prévoir un `aria-label` distinctif ou un `data-testid` intentionnel dès la conception, pas en réaction à un E2E qui échoue.

### 4. Spec 5B.3 incomplète sur AC3 et AC9

AC3 spécifiait les boutons Success/Fail toujours visibles — l'UX finale (bouton "Edit" collapsé) est meilleure mais a émergé pendant le dev, pas par design initial. AC9 (historique des positionnements) n'était pas dans la spec du tout.

**Pattern récurrent :** les features émergent plus riches que la spec. C'est positif, mais génère des itérations en fin de story. À anticiper en créant des specs légèrement plus conservatrices et en listant explicitement les "non-goals" dans l'AC.

---

## Insights clés

1. **Reconstruire sur des bases saines vaut mieux que patcher.** Le flip initial de Romain face au mauvais modèle de données était légitime — mais la décision de prendre le temps de réfléchir hors IA et de concevoir le bon modèle a produit une architecture qui tient vraiment. 5B.3 n'aurait pas été possible proprement sans 5B.1.

2. **Le signal de conversion existait dans le code avant d'exister dans le produit.** `outcome = 'success'` est maintenant stocké proprement — Epic 6 peut désormais calculer sur des données réelles. L'ordre des epics n'était pas arbitraire.

3. **TanStack Query réactivité vs UI state** — pattern à documenter. La réactivité qui efface du state UI utile est un anti-pattern subtil qui se manifestera probablement à nouveau dans d'autres contextes (toute popup ou dialog qui dépend de données serveur + attend une interaction).

4. **Le code review adversarial a une vraie valeur** — pas seulement pour trouver des bugs, mais pour améliorer l'UX (AC3 collapsé) et compléter des features manquantes (AC9 historique).

---

## Évaluation de complétude

| Critère | Statut |
|---------|--------|
| 3/3 stories `done` | ✅ |
| 245 tests fonctionnels passent | ✅ |
| 10 tests E2E Playwright stables | ✅ |
| `pnpm biome check` → 0 erreurs | ✅ |
| Type-check backend + frontend → 0 erreurs | ✅ |
| Chaîne complète : Prospect → Stage → Positioning → Outcome | ✅ |
| Signal de conversion prêt pour Epic 6 | ✅ |
| Dette technique critique | ✅ Aucune |

**Epic 5B est complet et solide.**

---

## Action Items

### Statut final — tous traités (2026-03-29)

| # | Action | Priorité | Statut |
|---|--------|----------|--------|
| A1 | **Checklist `hardResetTestData`** : documenter l'ordre de suppression dans `test_controller.ts` | Haute | ✅ |
| A2 | **Pattern "captured state popup"** : documenter dans `architecture.md` | Moyenne | ✅ |
| A3 | **Convention noms accessibles** : `aria-label` distinctif sur boutons ambigus | Moyenne | ✅ |
| A4 | **TanStack Query cache audit** — `staleTime`, `gcTime`, invalidations, `setQueryData` | Haute | ✅ |
| A5 | **Zustand audit complet** — évaluation de pertinence sur toute l'appli | Moyenne | ✅ |
| A6 | **Scaffold Playwright extension** — contexte `--load-extension`, worker fixture | Haute | ✅ |
| A7 | **Documenter token Bearer extension** dans `architecture.md` | Haute | ✅ |
| A8 | **Valider spec Epic 7** dans `epics.md` | Haute | ✅ |

---

## Traitement des Action Items (2026-03-29)

### A1 — Checklist `hardResetTestData`

**Fichier :** `apps/backend/app/controllers/test_controller.ts`

Commentaire JSDoc mis à jour pour lister l'ordre de suppression complet :
```
interactions → prospect_stage_transitions → prospect_positionings → prospects → positionings → funnel_stages
```
Règle ajoutée : toute nouvelle table avec FK vers une entité existante doit être insérée avant son parent dans cet ordre.

**Fichier :** `_bmad-output/planning-artifacts/architecture.md`

Section "Process Patterns" enrichie avec la checklist complète et l'explication du pourquoi (FK constraints, soft deletes).

---

### A2 — Pattern "captured state popup"

**Fichier :** `_bmad-output/planning-artifacts/architecture.md`

Anti-pattern documenté sous "Process Patterns — TanStack Query" : quand une popup dépend de données serveur et attend une interaction utilisateur, un refetch TanStack Query peut effacer `activePositioning` avant que l'utilisateur clique. Solution : capturer les valeurs au moment d'ouvrir la popup (pas les lire en live depuis le prospect). Exemple TSX inclus.

---

### A3 — Convention noms accessibles

**Fichier :** `apps/frontend/src/features/prospects/components/ProspectDetail.tsx`

Ajout de `aria-label={t('prospects.aria.editProspect', { name: prospect.name })}` sur le bouton Edit prospect.

**Fichier :** `apps/frontend/src/features/prospects/components/PositioningSection.tsx`

Ajout de `aria-label={t('prospects.positioning.aria.editOutcome')}` sur le bouton Edit outcome (en complément du `data-testid` existant).

**Fichiers :** `apps/frontend/public/locales/fr.json` + `en.json`

Nouvelles clés i18n ajoutées : `prospects.aria.editProspect` et `prospects.positioning.aria.editOutcome`.

**Fichiers E2E :** `tests/e2e/prospects-crud.spec.ts`, `prospects-kanban.spec.ts`, `prospects-archive.spec.ts`

- `/^edit$/i` → `/^edit/i` (5 occurrences) — le bouton a maintenant un accessible name complet type "Edit Initial Prospect"
- `[aria-label*="Archive"]` → `[aria-label^="Archive"]` (5 occurrences) — starts-with au lieu de contains pour éviter le match sur "Edit **To Be Archive**d"

**Fichier :** `_bmad-output/planning-artifacts/architecture.md`

Table de convention des noms accessibles ajoutée sous "Naming Patterns".

---

### A4 — TanStack Query cache audit

Audit complet des mutations, invalidations et configuration QueryClient. Corrections apportées :

**`apps/frontend/src/App.tsx`**
- `staleTime: 2 * 60 * 1000` (2 min) — évite les refetches sur window focus / remount
- `gcTime: 10 * 60 * 1000` (10 min) — garde les pages récentes en cache pendant la navigation

**`apps/frontend/src/features/prospects/hooks/useProspectMutations.ts`**
- `useUpdateProspect` : `setQueryData(detail)` + `setQueriesData(list)` — injection directe, 0 refetch
- `useArchiveProspect` / `useRestoreProspect` : invalidation `list()` + `detail(id)` (granulaire)

**`apps/frontend/src/features/prospects/hooks/useProspectPositioningMutations.ts`**
- `useAssignPositioning` + `useSetPositioningOutcome` : invalidation `list()` + `detail(id)` + `positionings(id)` — NOT stage-transitions (assign/outcome ne déplacent pas de stage)

**`apps/frontend/src/features/positionings/hooks/usePositioningMutations.ts`**
- `useUpdatePositioning` : `setQueriesData(positionings.list)` + `invalidateQueries(prospects.list)` — prospects invalidés car `positioningName` est embarqué dans `prospect.activePositioning`
- `useArchivePositioning` : `positionings.list()` + `prospects.list()` — archivage set `outcome='failed'` sur les prospects liés

**`apps/frontend/src/features/interactions/hooks/useInteractionMutations.ts`**
- `useUpdateInteraction` : `setQueriesData(interactions.list)` — injection directe, 0 refetch

---

### A5 — Audit Zustand

Audit complet de toute l'appli frontend : tous les `useState`, `useReducer`, Context, et `localStorage` analysés.

**Verdict : Zustand non nécessaire à ce stade.** La discipline de state management actuelle est bonne. TanStack Query gère le server state, `useState` local gère l'UI state. Pas de prop drilling profond problématique.

Trois candidats évalués :

| Candidat | Valeur | Verdict |
|----------|--------|---------|
| `ProspectsViewStore` — partager `searchQuery`/`showArchived` entre ListView et KanbanView | Moyenne — filtres perdus au changement de vue | À envisager si UX confirme le besoin ; sinon lifting state up suffit |
| `ModalsStore` — centraliser les dialogs | Faible — refactor cosmétique | Pas justifié |
| `InteractionContextStore` — remplacer localStorage | Très faible — micro-optimisation | Pas justifié |

---

### A6 — Scaffold Playwright extension

**Fichier :** `tests/support/fixtures/extension-fixture.ts` (nouveau)

Worker fixture `extensionContext` : `launchPersistentContext` avec `--load-extension` + `--disable-extensions-except`. Worker fixture `extensionId` : extrait depuis l'URL du service worker. Fixture `extensionLoginAs` : POST vers `/api/extension/auth/login`, retourne le Bearer token.

**Fichier :** `tests/e2e-extension/extension-smoke.spec.ts` (nouveau)

1 test actif (extensionId format `/^[a-z]{32}$/`). 4 tests skippés annotés avec les blockers Story 7.1/7.3.

**Fichiers :** `playwright.config.ts` + `package.json`

- Nouveau projet `extension` : `testMatch: /e2e-extension\/.*\.spec\.ts/`, sans dépendance `setup`
- `test:e2e` → `--project=chromium` (exclut extension du run par défaut)
- `test:e2e:extension` → `--project=extension` (nouveau script)

---

### A7 — Documentation token Bearer extension

**Fichier :** `_bmad-output/planning-artifacts/architecture.md`

Table "Deux mécanismes d'authentification" ajoutée : session cookies httpOnly (web app) vs Bearer token opaque (extension). Distinctions : stockage, transmission, révocation, expiration, cas d'usage.

Titre de section corrigé : "Browser Extension Architecture (Epic 8)" → "Epic 7".

---

### A8 — Validation spec Epic 7

Spec lue et validée. Périmètre : 6 stories (7.1 token auth backend, 7.2 API prospect extension, 7.3 scaffold extension, 7.4 settings/auth UI, 7.5 badge LinkedIn, 7.6 floating panel). Pas d'ambiguïté bloquante identifiée. Prêt à démarrer Story 7.1.

---

### Accord d'équipe

- **Ordre d'exécution :** Epic 7 (LinkedIn Extension) avant Epic 6 (Battle Analytics) — décision confirmée et maintenue depuis retro Epic 5
- **Spec conservatrice :** lister les "non-goals" explicitement dans les AC pour limiter le scope creep en fin de story
- **`hardResetTestData` :** ordre de suppression à mettre à jour à chaque nouvelle table avec FK vers entités existantes

---

## Preview Epic 7 — LinkedIn Browser Extension

### Ce qu'on sait

- **6 stories** : token auth backend, API prospect dédiée extension, scaffold extension, settings/auth UI, badge LinkedIn, floating panel add/update
- **Stack** : extension Chromium (Manifest V3), communication BattleCRM API via token Bearer
- **Dépendances** : Epic 1 (auth backend) ✅, Epic 3 (prospects API) ✅
- **Indépendant de** : Epic 5B, Epic 6, Epic 8

### Risques à anticiper

- **Manifest V3** : pas de background persistent, service workers limités → valider dès Story 7.1
- **CORS + cookie vs token** : l'extension ne peut pas utiliser les httpOnly session cookies → mécanisme token Bearer dédié à concevoir en Story 7.1
- **Tests E2E extension** : config Playwright `--load-extension` à scaffolder tôt (A6)
- **DOM LinkedIn obfusqué** : stratégie de détection robuste à définir en Story 7.5

### Ce qui a changé depuis la retro Epic 5

Epic 5B a branché le signal de conversion. Epic 6 peut maintenant s'appuyer sur des données réelles quand il arrivera. Aucun changement sur les dépendances d'Epic 7.

---

*Rétrospective générée par Bob (SM Agent, Claude Sonnet 4.6) — 2026-03-28*
