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

### Avant Epic 7

| # | Action | Priorité |
|---|--------|----------|
| A1 | **Checklist `hardResetTestData`** : documenter que toute nouvelle junction table avec FK vers `prospects` ou `positionings` doit être ajoutée à l'ordre de suppression dans `test_controller.ts` | Haute |
| A2 | **Pattern "captured state popup"** : documenter dans `architecture.md` — quand TanStack Query peut effacer du state UI pendant un refetch, capturer les valeurs au moment d'ouvrir (ex: `outcomePositioningName`) | Moyenne |
| A3 | **Convention noms accessibles** : deux boutons avec le même nom accessible dans la même vue → `aria-label` distinctif ou `data-testid` intentionnel dès la conception | Moyenne |
| A4 | **[Carry-over Epic 5] Investigation TanStack Query cache** — audit `staleTime` et granularité des invalidations | Haute |
| A5 | **[Carry-over Epic 5] Zustand pour funnel stages** — envisager si staleTime insuffisant | Moyenne |

### Pendant / avant Epic 7

| # | Action | Priorité |
|---|--------|----------|
| A6 | Scaffolder le contexte test Playwright pour extension Chromium (`--load-extension`, config spécifique) | Haute |
| A7 | Documenter mécanisme token Bearer dédié extension dans `architecture.md` (distinct des session cookies httpOnly) | Haute |
| A8 | Lire + valider la spec Epic 7 dans `epics.md` avant Story 7.1 — confirmer le périmètre des 6 stories | Haute |

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
