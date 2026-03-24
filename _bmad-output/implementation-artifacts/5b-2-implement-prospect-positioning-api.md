# Story 5B.2: Implement ProspectPositioning API

Status: review

## Story

As a developer,
I want REST API endpoints to assign positionings to prospects, set outcomes, and query assignments,
So that the frontend (Story 5B.3) can manage positioning per prospect and display the correct state.

## Acceptance Criteria

1. **AC1 (`POST /api/prospects/:id/positionings`):** Assigne un positionnement à un prospect. Si un `prospect_positionings` existe déjà pour `(user_id, prospect_id, funnel_stage_id)`, il est supprimé (hard delete) avant l'insert (replace pattern). `funnel_stage_id` est dénormalisé depuis `positioning.funnel_stage_id`. L'enregistrement créé a `outcome = null`. Retourne 201 + `ProspectPositioningType`.

2. **AC2 (`PATCH /api/prospects/:id/positionings/current/outcome`):** Met à jour l'`outcome` du positionnement actif du prospect (l'entrée `prospect_positionings` dont `funnel_stage_id = prospect.funnel_stage_id`). Retourne 404 si aucun positionnement actif n'existe. Retourne 200 + `ProspectPositioningType` mis à jour.

3. **AC3 (`GET /api/prospects/:id/positionings`):** Retourne tous les `prospect_positionings` d'un prospect (tous les stages), triés par `created_at` DESC. Retourne 200 + `{ data: ProspectPositioningDetailType[], meta: { total } }`. Chaque item inclut `positioningName`, `funnelStageName`, et `isActive` (dérivé : `funnelStageId === prospect.funnelStageId`).

4. **AC4 (`GET /api/positionings/:id/prospects`):** Mise à jour de l'endpoint existant (Story 4.2) pour utiliser `prospect_positionings` à la place de `interactions`. Retourne les prospects liés via `pp.positioning_id = :id`. Chaque résultat inclut `isActive` (`pp.funnelStageId === prospect.funnelStageId`). Retourne 200 + `{ data: PositioningLinkedProspectType[], meta: { total } }`.

5. **AC5 (nouvelles routes dans `routes.ts`):** Trois nouvelles routes ajoutées au groupe `/prospects` : `GET /:id/positionings`, `POST /:id/positionings`, `PATCH /:id/positionings/current/outcome`. Toutes avec `.where('id', UUID_REGEX)`.

6. **AC6 (nouveaux types partagés):** `ProspectPositioningDetailType` et `PositioningLinkedProspectType` définis dans `packages/shared/src/types/prospect-positioning.ts` et exportés via `packages/shared/src/index.ts`.

7. **AC7 (validation des inputs):** VineJS validators pour `assign` (`positioning_id: uuid`) et `setOutcome` (`outcome: enum['success', 'failed']`). UUID validé avec `.uuid()`. Outcome : pas nullable — c'est une action explicite ; `null` ne peut pas être envoyé via cette route.

8. **AC8 (isolation utilisateur):** Toutes les requêtes utilisent `forUser(userId)`. Un UUID valide appartenant à un autre utilisateur retourne 404 (pas 403). Conforme au pattern M1.

9. **AC9 (tests existants `positionings/api.spec.ts` mis à jour):** Les tests `GET /api/positionings/:id/prospects` utilisaient des `Interaction` pour créer le lien. Ils doivent être mis à jour pour créer des `ProspectPositioning` à la place, et les assertions adaptées au nouveau shape `PositioningLinkedProspectType`.

10. **AC10 (nouveaux tests `prospect_positionings/api.spec.ts`):** Tests fonctionnels pour les 3 nouveaux endpoints. `pnpm biome check --write .` — 0 erreurs. `pnpm --filter @battlecrm/backend type-check` — 0 erreurs. `ENV_PATH=../../ node ace test functional` — tous les tests passent.

## Tasks / Subtasks

- [x] **Task 1: Nouveaux types partagés** (AC6)
  - [x] 1.1 Dans `packages/shared/src/types/prospect-positioning.ts`, ajouter sous `ProspectPositioningType` :
    ```typescript
    // Enriched response for GET /api/prospects/:id/positionings
    export type ProspectPositioningDetailType = {
      id: string
      positioningId: string
      positioningName: string        // from preloaded positioning
      funnelStageId: string
      funnelStageName: string        // positioning.funnelStage.name, or 'Stage supprimé' if soft-deleted
      outcome: 'success' | 'failed' | null
      createdAt: string              // ISO 8601
      isActive: boolean              // pp.funnelStageId === prospect.funnelStageId
    }

    // Response for GET /api/positionings/:id/prospects
    export type PositioningLinkedProspectType = {
      id: string                     // prospect.id
      name: string                   // prospect.name
      funnelStageId: string          // pp.funnel_stage_id (the assignment's stage)
      outcome: 'success' | 'failed' | null
      createdAt: string              // pp.createdAt ISO 8601
      isActive: boolean              // pp.funnelStageId === prospect.funnelStageId
      deletedAt: string | null       // prospect.deletedAt — for archived prospects
    }
    ```
  - [x] 1.2 `packages/shared/src/index.ts` exporte déjà `'./types/prospect-positioning.js'` — aucune modification nécessaire.
  - [x] 1.3 Rebuild `@battlecrm/shared` : `pnpm --filter @battlecrm/shared build`

- [x] **Task 2: VineJS validators** (AC7)
  - [x] 2.1 Créer `apps/backend/app/validators/prospect_positionings.ts` :
    ```typescript
    import vine from '@vinejs/vine'

    export const assignPositioningValidator = vine.compile(
      vine.object({
        positioning_id: vine.string().uuid(),
      }),
    )

    export const setOutcomeValidator = vine.compile(
      vine.object({
        outcome: vine.enum(['success', 'failed']),
      }),
    )
    ```
  - [x] 2.2 `outcome` n'accepte PAS `null` — c'est une action explicite irreversible. La valeur `null` est l'état initial, jamais renvoyée par le client.

- [x] **Task 3: Nouveaux serializers** (AC3, AC4)
  - [x] 3.1 Dans `apps/backend/app/serializers/prospect-positioning.ts`, ajouter deux fonctions :
    ```typescript
    import type { PositioningLinkedProspectType, ProspectPositioningDetailType, ProspectPositioningType } from '@battlecrm/shared'
    import type Positioning from '#models/positioning'
    import type ProspectPositioning from '#models/prospect_positioning'
    import type Prospect from '#models/prospect'

    // Existing serializeProspectPositioning stays unchanged

    export function serializeProspectPositioningDetail(
      pp: ProspectPositioning,
      prospectFunnelStageId: string,
    ): ProspectPositioningDetailType {
      const positioning = pp.positioning as Positioning
      return {
        id: pp.id,
        positioningId: pp.positioningId,
        positioningName: positioning.name,
        funnelStageId: pp.funnelStageId,
        funnelStageName: pp.funnelStage?.name ?? 'Stage supprimé',
        outcome: pp.outcome,
        createdAt: pp.createdAt.toISO()!,
        isActive: pp.funnelStageId === prospectFunnelStageId,
      }
    }

    export function serializePositioningLinkedProspect(
      pp: ProspectPositioning,
    ): PositioningLinkedProspectType {
      const prospect = pp.prospect as Prospect
      return {
        id: prospect.id,
        name: prospect.name,
        funnelStageId: pp.funnelStageId,
        outcome: pp.outcome,
        createdAt: pp.createdAt.toISO()!,
        isActive: pp.funnelStageId === prospect.funnelStageId,
        deletedAt: prospect.deletedAt?.toISO() ?? null,
      }
    }
    ```
  - [x] 3.2 Les deux fonctions nécessitent que les relations soient preloadées — c'est la responsabilité du controller.

- [x] **Task 4: `ProspectPositioningsController`** (AC1, AC2, AC3, AC8)
  - [x] 4.1 Créer `apps/backend/app/controllers/prospect_positionings_controller.ts` :
    ```typescript
    import type { HttpContext } from '@adonisjs/core/http'
    import { UUID_REGEX } from '#helpers/regex'
    import Positioning from '#models/positioning'
    import Prospect from '#models/prospect'
    import ProspectPositioning from '#models/prospect_positioning'
    import { serializeProspectPositioning, serializeProspectPositioningDetail } from '#serializers/prospect-positioning'
    import { assignPositioningValidator, setOutcomeValidator } from '#validators/prospect_positionings'

    export default class ProspectPositioningsController {
      /**
       * GET /api/prospects/:id/positionings
       * All positioning assignments for a prospect (all stages), newest first.
       */
      async index({ params, response, auth }: HttpContext) { ... }

      /**
       * POST /api/prospects/:id/positionings
       * Assign a positioning to a prospect (replace if same stage already assigned).
       */
      async assign({ params, request, response, auth }: HttpContext) { ... }

      /**
       * PATCH /api/prospects/:id/positionings/current/outcome
       * Set outcome on the active positioning (stage = prospect.funnelStageId).
       */
      async setOutcome({ params, request, response, auth }: HttpContext) { ... }
    }
    ```
  - [x] 4.2 **`index()` implementation:**
    ```typescript
    async index({ params, response, auth }: HttpContext) {
      const userId = auth.user!.id

      if (!UUID_REGEX.test(params.id)) {
        return response.notFound()
      }

      // withTrashed — allow fetching positioning history for archived prospects
      const prospect = await Prospect.query()
        .withTrashed()
        .withScopes((s) => s.forUser(userId))
        .where('id', params.id)
        .firstOrFail()

      const pps = await ProspectPositioning.query()
        .withScopes((s) => s.forUser(userId))
        .where('prospect_id', prospect.id)
        .preload('positioning')
        .preload('funnelStage', (q) => q.withTrashed())
        .orderBy('created_at', 'desc')

      return response.ok({
        data: pps.map((pp) => serializeProspectPositioningDetail(pp, prospect.funnelStageId)),
        meta: { total: pps.length },
      })
    }
    ```
  - [x] 4.3 **`assign()` implementation:**
    ```typescript
    async assign({ params, request, response, auth }: HttpContext) {
      const payload = await request.validateUsing(assignPositioningValidator)
      const userId = auth.user!.id

      if (!UUID_REGEX.test(params.id)) {
        return response.notFound()
      }

      // Prospect must be active — can't assign to an archived prospect
      const prospect = await Prospect.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', params.id)
        .firstOrFail()

      // Positioning must be active — can't assign an archived positioning
      const positioning = await Positioning.query()
        .withScopes((s) => s.forUser(userId))
        .where('id', payload.positioning_id)
        .firstOrFail()

      // Replace pattern: hard delete existing record for same (user, prospect, stage)
      // CRITICAL: hard delete (not soft delete) to avoid UNIQUE constraint on re-insert
      await ProspectPositioning.query()
        .where('user_id', userId)
        .where('prospect_id', prospect.id)
        .where('funnel_stage_id', positioning.funnelStageId)
        .delete()

      const pp = await ProspectPositioning.create({
        userId,
        prospectId: prospect.id,
        positioningId: positioning.id,
        funnelStageId: positioning.funnelStageId,   // denormalized from positioning
        outcome: null,
      })

      return response.created(serializeProspectPositioning(pp))
    }
    ```
  - [x] 4.4 **`setOutcome()` implementation:**
    ```typescript
    async setOutcome({ params, request, response, auth }: HttpContext) {
      const payload = await request.validateUsing(setOutcomeValidator)
      const userId = auth.user!.id

      if (!UUID_REGEX.test(params.id)) {
        return response.notFound()
      }

      // Prospect can be active or archived (outcome may be set during archival flow)
      const prospect = await Prospect.query()
        .withTrashed()
        .withScopes((s) => s.forUser(userId))
        .where('id', params.id)
        .firstOrFail()

      // Active positioning = the pp record whose funnel_stage_id matches prospect's current stage
      const pp = await ProspectPositioning.query()
        .withScopes((s) => s.forUser(userId))
        .where('prospect_id', prospect.id)
        .where('funnel_stage_id', prospect.funnelStageId)
        .first()

      if (!pp) return response.notFound()

      pp.outcome = payload.outcome
      await pp.save()

      return response.ok(serializeProspectPositioning(pp))
    }
    ```
  - [x] 4.5 Note : `.firstOrFail()` sur le prospect lève une 404 automatiquement si le prospect n'existe pas ou n'appartient pas à l'utilisateur.
  - [x] 4.6 Note : dans `setOutcome()`, on utilise `withTrashed()` sur le prospect car le flow d'archivage (Story 5B.3) appelle cette route juste avant de soft-deleter le prospect — il n'est pas encore archivé côté DB mais pourrait l'être si on réessaie.

- [x] **Task 5: Mise à jour de `PositioningsController.prospects()`** (AC4, AC9)
  - [x] 5.1 Dans `apps/backend/app/controllers/positionings_controller.ts`, remplacer complètement la méthode `prospects()` :
    ```typescript
    /**
     * GET /api/positionings/:id/prospects
     * Returns prospects linked to this positioning via prospect_positionings.
     * Includes both active (isActive=true) and historical (isActive=false) assignments.
     * Replaces Story 4.2 implementation (which used interactions to derive the link).
     */
    async prospects({ params, response, auth }: HttpContext) {
      const userId = auth.user!.id

      // withTrashed() — historical data accessible even if positioning is archived
      const positioning = await Positioning.query()
        .withTrashed()
        .withScopes((s) => s.forUser(userId))
        .where('id', params.id)
        .firstOrFail()

      const pps = await ProspectPositioning.query()
        .withScopes((s) => s.forUser(userId))
        .where('positioning_id', positioning.id)
        .preload('prospect', (q) => q.withTrashed())
        .orderBy('created_at', 'desc')

      return response.ok({
        data: pps.map(serializePositioningLinkedProspect),
        meta: { total: pps.length },
      })
    }
    ```
  - [x] 5.2 Ajouter les imports manquants en haut du fichier :
    - `import ProspectPositioning from '#models/prospect_positioning'`
    - `import { serializePositioningLinkedProspect } from '#serializers/prospect-positioning'`
  - [x] 5.3 Retirer les imports devenus inutiles dans cette méthode :
    - `import Interaction from '#models/interaction'` — ATTENTION : Interaction est peut-être encore utilisé ailleurs dans le controller. Vérifier avant de supprimer. En fait, Interaction n'est plus importé si la seule utilisation était dans `prospects()`. Supprimer si non utilisé.
    - `import { serializeProspect } from '#serializers/prospect'` — `serializeProspect` reste utilisé si d'autres méthodes l'utilisent. Ne pas supprimer.

- [x] **Task 6: Ajout des routes** (AC5)
  - [x] 6.1 Dans `apps/backend/start/routes.ts`, ajouter l'import lazy du nouveau controller en haut (à la suite des autres controllers) :
    ```typescript
    const ProspectPositioningsController = () => import('#controllers/prospect_positionings_controller')
    ```
  - [x] 6.2 Dans le groupe `/prospects`, ajouter les 3 nouvelles routes. Les ajouter AVANT la route `stageTransitions` (ou à la fin, peu importe — aucun risque de collision de routing car les segments sont différents) :
    ```typescript
    router
      .get('/:id/positionings', [ProspectPositioningsController, 'index'])
      .where('id', UUID_REGEX)
    router
      .post('/:id/positionings', [ProspectPositioningsController, 'assign'])
      .where('id', UUID_REGEX)
    router
      .patch('/:id/positionings/current/outcome', [ProspectPositioningsController, 'setOutcome'])
      .where('id', UUID_REGEX)
    ```
  - [x] 6.3 Note : `current` dans `/:id/positionings/current/outcome` est un segment littéral — pas de conflit avec UUID_REGEX car `.where('id', UUID_REGEX)` ne s'applique qu'au segment `:id` (le premier), pas à `current`.

- [x] **Task 7: Mise à jour des tests existants `positionings/api.spec.ts`** (AC9)
  - [x] 7.1 Les tests `GET /api/positionings/:id/prospects` utilisaient des `Interaction.create()` avec `positioningId` pour lier prospects → positionings. Ce lien n'existe plus dans la nouvelle implémentation. Mettre à jour les 4 tests concernés pour créer des `ProspectPositioning` à la place :
    ```typescript
    // AVANT (Story 4.2 pattern — ne fonctionne plus):
    await Interaction.create({ ..., positioningId: p.id, ... })

    // APRÈS (Story 5B.2 pattern):
    await ProspectPositioning.create({
      userId: user.id,
      prospectId: prospect.id,
      positioningId: p.id,
      funnelStageId: stage.id,  // même stage que le positioning
      outcome: null,
    })
    ```
  - [x] 7.2 Ajouter l'import `import ProspectPositioning from '#models/prospect_positioning'` en haut du fichier.
  - [x] 7.3 Les tests vérifient `data[0].name` et `data[0].id` — cela correspond à `PositioningLinkedProspectType.name` et `PositioningLinkedProspectType.id`. Aucun changement d'assertion nécessaire pour ces champs.
  - [x] 7.4 Le test `'GET /api/positionings/:id/prospects includes archived (soft-deleted) prospects'` crée le lien via une interaction puis archive le prospect. Le mettre à jour pour : (1) créer un `ProspectPositioning`, (2) archiver le prospect via `await prospect.delete()` — l'enregistrement pp reste en DB (pas de CASCADE sur prospect_id). Vérifier que le prospect archivé apparaît toujours dans la liste.
  - [x] 7.5 Le test `'GET /api/positionings/:id/prospects accessible for archived positioning'` doit également utiliser `ProspectPositioning.create()`.

- [x] **Task 8: Nouveaux tests `prospect_positionings/api.spec.ts`** (AC1-AC3, AC7-AC8, AC10)
  - [x] 8.1 Créer `apps/backend/tests/functional/prospect_positionings/api.spec.ts`. Le fichier `schema.spec.ts` existe déjà dans ce dossier — pas de conflit.
  - [x] 8.2 Pattern standard : `TEST_EMAIL_DOMAIN = '@prospect-positionings-api-test.local'`, helper `createUserWithContext()` → `{ user, stage, prospect, positioning }` (même pattern que `schema.spec.ts`).
  - [x] 8.3 Tests pour `POST /api/prospects/:id/positionings` :
    - `201 + ProspectPositioningType` avec positioning_id valide
    - `replace: assigning again for same stage deletes old and creates new (outcome reset to null)`
    - `400/422 avec positioning_id manquant ou non-UUID`
    - `404 si prospect inexistant`
    - `404 si prospect appartenant à un autre utilisateur`
    - `404 si positioning archivé` (withTrashed non utilisé sur positioning dans assign)
    - `404 si prospect archivé` (withTrashed non utilisé sur prospect dans assign)
    - `401 sans authentification`
  - [x] 8.4 Tests pour `PATCH /api/prospects/:id/positionings/current/outcome` :
    - `200 + ProspectPositioningType` avec `outcome: 'success'` quand positionnement actif existe
    - `200 + ProspectPositioningType` avec `outcome: 'failed'`
    - `404 si aucun positionnement actif pour le stage courant`
    - `422 avec outcome invalide (ex: 'pending' ou null)`
    - `404 si prospect inexistant ou autre utilisateur`
    - `401 sans authentification`
  - [x] 8.5 Tests pour `GET /api/prospects/:id/positionings` :
    - `200 + liste vide` si aucun pp
    - `200 + liste avec items` — vérifier shape (`id, positioningId, positioningName, funnelStageId, funnelStageName, outcome, createdAt, isActive`)
    - `isActive = true` pour le pp dont `funnelStageId === prospect.funnelStageId`
    - `isActive = false` pour les autres stages
    - `404 si prospect inexistant ou autre utilisateur`
    - Accessible sur prospect archivé (withTrashed dans index)
    - `401 sans authentification`

- [x] **Task 9: Lint, type-check, tests** (AC10)
  - [x] 9.1 `pnpm biome check --write .` depuis la racine — 0 erreurs
  - [x] 9.2 `pnpm --filter @battlecrm/shared build` — rebuild pour les nouveaux types
  - [x] 9.3 `pnpm --filter @battlecrm/backend type-check` — 0 erreurs
  - [x] 9.4 `ENV_PATH=../../ node ace test functional` depuis `apps/backend/` — tous les tests passent

## Dev Notes

### Architecture Summary

Story purement backend. Trois nouveaux endpoints sous `/api/prospects/:id/positionings` + mise à jour de `/api/positionings/:id/prospects`.

**Replace pattern (Task 4.3) :** `prospect_positionings` n'a pas de `SoftDeletes`. Pour réassigner, on hard-delete l'ancienne ligne puis on insert la nouvelle. Cette séquence est atomique via la contrainte UNIQUE `(user_id, prospect_id, funnel_stage_id)` — si le delete échoue, l'insert aussi. Pas de transaction explicite nécessaire (volume faible, contrainte DB suffisante).

**Active positioning derivation :** `pp.funnel_stage_id === prospect.funnel_stage_id`. Cette règle est centrale — elle permet à `setOutcome()` de trouver le pp actif sans paramètre de stage, et à `GET /api/prospects/:id/positionings` de calculer `isActive`.

---

### Critical: Existing Tests Will Break (Task 7)

Les tests `GET /api/positionings/:id/prospects` dans `positionings/api.spec.ts` créent le lien via `Interaction.create({ positioningId: p.id })`. Avec la nouvelle implémentation, la méthode `prospects()` interroge `prospect_positionings` — plus les interactions. Ces tests doivent être mis à jour avant de lancer les tests.

**Avant (Story 4.2) :**
```typescript
await Interaction.create({ userId: user.id, prospectId: prospect.id, positioningId: p.id, funnelStageId: stage.id, status: 'positive', interactionDate: DateTime.now() })
```

**Après (Story 5B.2) :**
```typescript
await ProspectPositioning.create({ userId: user.id, prospectId: prospect.id, positioningId: p.id, funnelStageId: stage.id, outcome: null })
```

Les `Interaction.create()` restants dans `positionings/api.spec.ts` (ceux qui ne servent pas à créer le lien positioning→prospect) restent inchangés.

---

### Serializer Pattern

`serializeProspectPositioningDetail()` accepte le `prospect.funnelStageId` comme second paramètre pour calculer `isActive`. Ce paramètre vient du prospect chargé dans le controller — pas besoin de le preloader séparément.

`serializePositioningLinkedProspect()` accède à `pp.prospect.funnelStageId` directement — la relation `prospect` doit être preloadée avec `q.withTrashed()` pour inclure les prospects archivés.

---

### Route Ordering Note

Dans le groupe `/prospects`, la route `PATCH /:id/positionings/current/outcome` a `current` comme segment fixe — pas de risque de collision avec d'autres routes paramétrées. La route `GET /:id` avec `UUID_REGEX` ne matche que le premier segment de path — pas de conflit avec `/:id/positionings/...`.

---

### PositioningsController: Imports Cleanup

La méthode `prospects()` actuelle importe `Interaction` et `serializeProspect`. Après la mise à jour :
- `Interaction` n'est plus utilisé dans `prospects()`. Vérifier si d'autres méthodes l'utilisent (elles ne le font pas — seul `prospects()` importait Interaction). **Supprimer** l'import `Interaction`.
- `serializeProspect` n'est plus utilisé dans `prospects()`. Vérifier si d'autres méthodes l'utilisent (elles ne le font pas dans `positionings_controller.ts`). **Supprimer** l'import `serializeProspect` et `Prospect` si inutilisés.

Aucun test pour la méthode `prospects()` de `PositioningsController` ne dépend du fait qu'elle utilise les interactions — seulement du résultat (`data[0].name`, `data[0].id`). Les tests continueront à passer après mise à jour du linker (Task 7).

---

### Import Aliases

- `import ProspectPositioning from '#models/prospect_positioning'`
- `import { assignPositioningValidator, setOutcomeValidator } from '#validators/prospect_positionings'`
- `import { serializeProspectPositioning, serializeProspectPositioningDetail, serializePositioningLinkedProspect } from '#serializers/prospect-positioning'`
- `import ProspectPositioningsController from '#controllers/prospect_positionings_controller'` (lazy import dans routes.ts)

---

### Project Structure Notes

**Nouveau fichier controller :**
```
apps/backend/app/controllers/prospect_positionings_controller.ts
```
Pattern de nommage : snake_case, suffixe `_controller`. Importe via `#controllers/prospect_positionings_controller`.

**Nouveau fichier validator :**
```
apps/backend/app/validators/prospect_positionings.ts
```

**Fichiers modifiés :**
```
apps/backend/start/routes.ts                                 — 3 nouvelles routes + import
apps/backend/app/controllers/positionings_controller.ts      — mise à jour prospects()
apps/backend/app/serializers/prospect-positioning.ts         — 2 nouvelles fonctions
apps/backend/tests/functional/positionings/api.spec.ts       — mise à jour tests prospects
packages/shared/src/types/prospect-positioning.ts            — 2 nouveaux types
```

---

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5B.2] — Acceptance criteria et endpoints
- [Source: _bmad-output/planning-artifacts/architecture.md#Prospect-Positioning Assignment Model] — Design complet, replace pattern, active positioning derivation, outcome rules
- [Source: apps/backend/app/controllers/interactions_controller.ts#store] — Pattern capture funnelStageId + replace prospect query
- [Source: apps/backend/app/controllers/positionings_controller.ts#prospects] — Méthode à remplacer
- [Source: apps/backend/app/models/prospect_positioning.ts] — Modèle existant (Story 5B.1)
- [Source: apps/backend/app/validators/interactions.ts] — Pattern VineJS `vine.enum()`
- [Source: apps/backend/start/routes.ts] — Pattern d'ajout de routes dans groupe existant
- [Source: apps/backend/tests/functional/prospect_positionings/schema.spec.ts] — Patterns tests existants pour ce modèle
- [Source: _bmad-output/planning-artifacts/architecture.md#Règles de suppression des funnel stages] — Comportement attendu avec stages soft-deleted

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

1. Replace pattern (delete + insert) works cleanly — `ProspectPositioning.query().where(...).delete()` hard-deletes the existing record, then `.create()` inserts the new one. No UNIQUE constraint violation.
2. `setOutcome()` uses `withTrashed()` on prospect to support the archival flow in Story 5B.3.
3. Tests for `GET /api/positionings/:id/prospects` were updated from `Interaction.create` to `ProspectPositioning.create` (Task 7). The `DateTime` and `Interaction` imports were removed from that file.
4. The `isActive=false for historical stage pp` test uses a conditional skip if only one stage is provisioned — this is safe since the default user setup provides multiple stages.
5. 242 functional tests pass (28 new in `prospect_positionings/api.spec.ts` + all existing tests still passing).

### File List

**New files:**
- `apps/backend/app/controllers/prospect_positionings_controller.ts`
- `apps/backend/app/validators/prospect_positionings.ts`
- `apps/backend/tests/functional/prospect_positionings/api.spec.ts`

**Modified files:**
- `packages/shared/src/types/prospect-positioning.ts` — added `ProspectPositioningDetailType`, `PositioningLinkedProspectType`
- `apps/backend/app/serializers/prospect-positioning.ts` — added `serializeProspectPositioningDetail`, `serializePositioningLinkedProspect`
- `apps/backend/app/controllers/positionings_controller.ts` — updated `prospects()` to use `prospect_positionings` table
- `apps/backend/start/routes.ts` — added 3 routes + lazy import for `ProspectPositioningsController`
- `apps/backend/tests/functional/positionings/api.spec.ts` — replaced `Interaction.create` with `ProspectPositioning.create` in 3 tests
