# Story 5.1: Create Interactions Database Schema

Status: review

## Story

As a developer,
I want an interactions table with model, shared types, and functional tests,
so that the Interaction Logging feature has a solid, tested data layer before any API or UI work begins.

## Acceptance Criteria

1. **AC1 (Migration):** La table `interactions` est créée avec les colonnes suivantes :
   - `id` (uuid, PK, `gen_random_uuid()`)
   - `user_id` (uuid, FK → `users.id`, `ON DELETE CASCADE`, NOT NULL)
   - `prospect_id` (uuid, FK → `prospects.id`, NOT NULL, NO CASCADE — soft-delete only)
   - `positioning_id` (uuid, FK → `positionings.id`, NULLABLE, `ON DELETE SET NULL`)
   - `status` (varchar, NOT NULL) — valeurs : `positive`, `pending`, `negative`
   - `notes` (text, NULLABLE)
   - `interaction_date` (timestamp, NOT NULL, default `now()`)
   - `created_at` (timestamp, NOT NULL)
   - `updated_at` (timestamp, NULLABLE)
   - `deleted_at` (timestamp, NULLABLE)
   - ⚠️ **Pas de colonnes `type` ou `subtype`** — décision produit rétro Epic 4

2. **AC2 (User isolation):** Le model `Interaction` expose un scope `forUser(userId)` qui filtre par `user_id`. Ce scope doit être utilisé dans **toutes** les requêtes.

3. **AC3 (Index):** Trois index composites existent :
   - `idx_interactions_user_prospect` sur `(user_id, prospect_id)` — requêtes par prospect
   - `idx_interactions_user_date` sur `(user_id, interaction_date)` — timeline chronologique
   - `idx_interactions_user_positioning` sur `(user_id, positioning_id)` — requêtes par positioning

4. **AC4 (Shared types):** Le fichier `packages/shared/src/types/interaction.ts` est créé avec `InteractionType`, `InteractionListResponse`, `CreateInteractionPayload`, `UpdateInteractionPayload`, `InteractionsFilterType`. Les types sont exportés depuis `packages/shared/src/index.ts`.

5. **AC5 (Model relations):** Les models `Prospect`, `User`, et `Positioning` sont mis à jour avec la relation `@hasMany(() => Interaction)`.

6. **AC6 (Tests):** 10 tests fonctionnels dans `tests/functional/interactions/schema.spec.ts` couvrant : création, isolation forUser, soft-delete, withTrashed, FK nullables, cascade `ON DELETE SET NULL`.

7. **AC7 (Qualité):** `pnpm biome check --write .` → 0 erreurs ; `pnpm type-check` → 0 erreurs.

## Tasks / Subtasks

- [x] Task 1: Migration `0006_create_interactions_table.ts` (AC1, AC3)
  - [x] Créer `apps/backend/database/migrations/0006_create_interactions_table.ts`
  - [x] Table `interactions` avec toutes les colonnes (pas de type/subtype)
  - [x] FK `user_id` → `users` (`ON DELETE CASCADE`)
  - [x] FK `prospect_id` → `prospects` (NOT NULL, pas de CASCADE)
  - [x] FK `positioning_id` → `positionings` (NULLABLE, `ON DELETE SET NULL`)
  - [x] Index `idx_interactions_user_prospect` sur `(user_id, prospect_id)`
  - [x] Index `idx_interactions_user_date` sur `(user_id, interaction_date)`
  - [x] Index `idx_interactions_user_positioning` sur `(user_id, positioning_id)`
  - [x] Méthode `down()` : aucun FK supplémentaire à dropper (les FKs sont sur la table elle-même)
  - [x] `ENV_PATH=../../ node ace migration:run` pour vérifier

- [x] Task 2: Model `Interaction` (AC2, AC5)
  - [x] Créer `apps/backend/app/models/interaction.ts`
  - [x] `compose(BaseModel, SoftDeletes)`
  - [x] Toutes les colonnes avec `@column` (voir Dev Notes pour types exacts)
  - [x] `@column.dateTime()` pour `interactionDate` (PAS autoCreate ni autoUpdate — setté explicitement)
  - [x] `static forUser = scope(...)` isolant par `user_id`
  - [x] Relations : `@belongsTo(() => User)`, `@belongsTo(() => Prospect)`, `@belongsTo(() => Positioning)`
  - [x] Mise à jour `apps/backend/app/models/prospect.ts` — ajouter `@hasMany(() => Interaction)`
  - [x] Mise à jour `apps/backend/app/models/user.ts` — ajouter `@hasMany(() => Interaction)`
  - [x] Mise à jour `apps/backend/app/models/positioning.ts` — ajouter `@hasMany(() => Interaction)`

- [x] Task 3: Types partagés (AC4)
  - [x] Créer `packages/shared/src/types/interaction.ts` (voir code complet en Dev Notes)
  - [x] Mettre à jour `packages/shared/src/index.ts` — ajouter l'export `interaction.js` (ordre alphabétique)
  - [x] `pnpm --filter @battlecrm/shared build` pour compiler

- [x] Task 4: Tests fonctionnels (AC6)
  - [x] Créer `apps/backend/tests/functional/interactions/schema.spec.ts`
  - [x] 10 tests (voir liste détaillée en Dev Notes)
  - [x] `ENV_PATH=../../ node ace test functional` — tous passent

- [x] Task 5: Qualité (AC7)
  - [x] `pnpm biome check --write .` depuis la racine — 0 erreurs
  - [x] `pnpm type-check` depuis la racine — 0 erreurs

## Dev Notes

### CRITICAL: Décision produit — pas de type/subtype

**⚠️ Le champ `type` et `subtype` pour les interactions sont SUPPRIMÉS du scope.**

Décision prise en rétro Epic 4 (2026-03-12) : le `positioning_id` définit déjà le contexte de l'interaction. Un positioning "Message LinkedIn v3" implique implicitement que c'est une interaction LinkedIn. Ajouter type/subtype violerait le principe "minimal friction" (< 1 minute pour logger). Le schema est délibérément minimal.

---

### Task 1: Migration complète

**Fichier : `apps/backend/database/migrations/0006_create_interactions_table.ts`**

```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'interactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      // user_id: CASCADE — interactions appartiennent à l'utilisateur
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')

      // prospect_id: NOT NULL, NO CASCADE — soft-delete only pour les prospects
      table.uuid('prospect_id').notNullable().references('id').inTable('prospects')

      // positioning_id: NULLABLE — une interaction peut exister sans positioning
      // SET NULL : si le positioning est hard-deleted (ne devrait pas arriver), l'interaction survive
      table
        .uuid('positioning_id')
        .nullable()
        .references('id')
        .inTable('positionings')
        .onDelete('SET NULL')

      // status: enum restreint par VineJS côté API, stocké en varchar
      table.string('status', 20).notNullable()

      // notes: texte libre, optionnel
      table.text('notes').nullable()

      // interaction_date: date/heure réelle de l'interaction (settée explicitement, pas auto)
      table.timestamp('interaction_date').notNullable().defaultTo(this.now())

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('deleted_at').nullable()

      // Index pour requêtes par prospect (timeline d'un prospect)
      table.index(['user_id', 'prospect_id'], 'idx_interactions_user_prospect')
      // Index pour timeline chronologique
      table.index(['user_id', 'interaction_date'], 'idx_interactions_user_date')
      // Index pour requêtes par positioning (analytics futur)
      table.index(['user_id', 'positioning_id'], 'idx_interactions_user_positioning')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

**Note `down()` :** Contrairement à la migration 0005 (positionings), cette migration n'ajoute pas de FK sur une table existante. Les FKs sont sur la table `interactions` elle-même — `dropTable` les supprime automatiquement.

---

### Task 2: Model Interaction

**Fichier : `apps/backend/app/models/interaction.ts`** (NOUVEAU)

```typescript
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SoftDeletes } from 'adonis-lucid-soft-deletes'
import type { DateTime } from 'luxon'
import Positioning from '#models/positioning'
import Prospect from '#models/prospect'
import User from '#models/user'

export default class Interaction extends compose(BaseModel, SoftDeletes) {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare prospectId: string

  @column()
  declare positioningId: string | null

  @column()
  declare status: 'positive' | 'pending' | 'negative'

  @column()
  declare notes: string | null

  @column.dateTime()
  declare interactionDate: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @column.dateTime()
  declare deletedAt: DateTime | null

  // User isolation — obligatoire sur toutes les requêtes
  static forUser = scope((query, userId: string) => {
    query.where('user_id', userId)
  })

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Prospect)
  declare prospect: BelongsTo<typeof Prospect>

  @belongsTo(() => Positioning)
  declare positioning: BelongsTo<typeof Positioning>
}
```

**Biome import order :** `@adonisjs/core/helpers` → `@adonisjs/lucid/orm` → `@adonisjs/lucid/types/relations` → `adonis-lucid-soft-deletes` → `luxon` → `#models/*` (alphabétique : Positioning, Prospect, User).

**IMPORTANT :** `interactionDate` utilise `@column.dateTime()` SANS `autoCreate`/`autoUpdate` — elle est settée explicitement lors de la création (depuis le payload ou `DateTime.now()`).

---

### Task 2b: Mises à jour des models existants

**`apps/backend/app/models/prospect.ts`** — ADD :
```typescript
// ADD to imports (alphabetical avec les autres #models):
import Interaction from '#models/interaction'

// ADD import types:
import type { HasMany } from '@adonisjs/lucid/types/relations'
// (HasMany est peut-être déjà importé — vérifier)

// ADD relation (après les autres @hasMany) :
@hasMany(() => Interaction)
declare interactions: HasMany<typeof Interaction>
```

**`apps/backend/app/models/user.ts`** — ADD :
```typescript
// ADD to imports:
import Interaction from '#models/interaction'

// ADD relation:
@hasMany(() => Interaction)
declare interactions: HasMany<typeof Interaction>
```

**`apps/backend/app/models/positioning.ts`** — ADD :
```typescript
// ADD to imports (alphabetical : Interaction avant Prospect):
import Interaction from '#models/interaction'

// ADD relation (avant @hasMany Prospect si ordre alphabétique) :
@hasMany(() => Interaction)
declare interactions: HasMany<typeof Interaction>
```

⚠️ **Dépendance circulaire :** `Interaction → Prospect` (belongsTo) `→ Interaction` (hasMany). Lucid gère via lazy-load `() => ModelClass` — pas de problème.

---

### Task 3: Types partagés

**Fichier : `packages/shared/src/types/interaction.ts`** (NOUVEAU)

```typescript
export type InteractionStatus = 'positive' | 'pending' | 'negative'

export type InteractionType = {
  id: string
  userId: string
  prospectId: string
  prospectName: string
  prospectFunnelStageId: string
  prospectFunnelStageName: string
  positioningId: string | null
  positioningName: string | null
  status: InteractionStatus
  notes: string | null
  interactionDate: string  // ISO 8601
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
}

export type InteractionListResponse = {
  data: InteractionType[]
  meta: { total: number }
}

export type CreateInteractionPayload = {
  prospect_id: string
  positioning_id?: string | null
  status: InteractionStatus
  notes?: string | null
  interaction_date?: string  // ISO 8601 ; defaults to now() if absent
}

export type UpdateInteractionPayload = {
  status?: InteractionStatus
  notes?: string | null
  positioning_id?: string | null
  interaction_date?: string
}

export type InteractionsFilterType = {
  prospect_id?: string
  positioning_id?: string
  status?: InteractionStatus
  funnel_stage_id?: string
  include_archived?: boolean
}
```

**Mettre à jour `packages/shared/src/index.ts`** — ajouter entre `funnel-stage.js` et `positioning.js` :
```typescript
export type * from './types/auth.js'
export type * from './types/funnel-stage.js'
export type * from './types/interaction.js'   // ADD — ordre alphabétique
export type * from './types/positioning.js'
export type * from './types/prospect.js'
```

Puis : `pnpm --filter @battlecrm/shared build`

---

### Task 4: Tests fonctionnels

**Fichier : `apps/backend/tests/functional/interactions/schema.spec.ts`** (NOUVEAU)

**10 tests à implémenter :**

1. `can create an interaction with all fields` — vérifie id, status, notes, interactionDate, positioningId
2. `can create an interaction with minimal fields (no positioning, no notes)` — positioningId et notes nullable
3. `forUser scope isolates interactions between users` — user A ne voit pas les interactions de user B
4. `each interaction belongs to the correct user_id`
5. `soft-deleted interactions excluded from default queries`
6. `withTrashed includes soft-deleted interactions`
7. `deleted_at is set on soft-delete and null after restore`
8. `interaction.prospectId references an existing prospect`
9. `interaction.positioningId is nullable (can be null)`
10. `ON DELETE SET NULL: hard-deleting a positioning nullifies interaction.positioningId`

**Pattern de setup (reprendre exactement depuis positionings/schema.spec.ts) :**
```typescript
const TEST_EMAIL_DOMAIN = '@interactions-schema-test.local'

group.each.teardown(async () => {
  await User.query().whereILike('email', `%${TEST_EMAIL_DOMAIN}`).delete()
})
```

**Pour le test 10 (ON DELETE SET NULL) :**
```typescript
// Bypass SoftDeletes — hard delete pour déclencher la contrainte DB
import db from '@adonisjs/lucid/services/db'
await db.from('positionings').where('id', positioning.id).delete()
const reloaded = await Interaction.findOrFail(interaction.id)
assert.isNull(reloaded.positioningId)
```

---

### Pièges connus

1. **Nullable fields en mémoire Lucid** — Les colonnes nullables non settées lors de `.create()` sont `undefined` en mémoire (pas `null`). Toujours recharger depuis la DB avant d'asserter `isNull` :
   ```typescript
   const reloaded = await Interaction.findOrFail(interaction.id)
   assert.isNull(reloaded.positioningId)  // ✅ — pas: assert.isNull(interaction.positioningId)
   ```

2. **`assert.property(model, 'id')` échoue sur Lucid** — Utiliser `assert.isDefined(model.id)` à la place.

3. **`interactionDate` n'est pas auto** — Setter explicitement lors de la création :
   ```typescript
   interactionDate: DateTime.now()  // ou depuis payload
   ```
   La DB a un `defaultTo(this.now())` mais Lucid en mémoire n'a pas `autoCreate` — il faut setter manuellement dans le controller (Story 5.2).

4. **Biome import order** — `#models/*` en ordre alphabétique : `Interaction` → `Positioning` → `Prospect` → `User`.

5. **`withTrashed()` AVANT `withScopes()`** — Pattern établi (Stories 3.5, 4.2) :
   ```typescript
   Interaction.query().withTrashed().withScopes((s) => s.forUser(userId))
   ```

---

### Project Structure Notes

**Nouveaux fichiers à créer :**
- `apps/backend/database/migrations/0006_create_interactions_table.ts`
- `apps/backend/app/models/interaction.ts`
- `apps/backend/tests/functional/interactions/schema.spec.ts`
- `packages/shared/src/types/interaction.ts`

**Fichiers existants à modifier :**
- `apps/backend/app/models/prospect.ts` — `@hasMany(() => Interaction)` + import
- `apps/backend/app/models/user.ts` — `@hasMany(() => Interaction)` + import
- `apps/backend/app/models/positioning.ts` — `@hasMany(() => Interaction)` + import
- `packages/shared/src/index.ts` — export `interaction.js`

**Aucun changement frontend** — story backend-only (migration + model + types). Pas d'endpoints API (Story 5.2). Pas de serializer (Story 5.2).

**⚠️ Scope :** Cette story couvre uniquement le schéma DB, le model Lucid, et les types partagés. Le serializer `serializeInteraction()` sera créé en Story 5.2 (comme pour positionings : 4.1 schema, 4.2 serializer).

---

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — ACs et BDD complets
- [Source: _bmad-output/implementation-artifacts/epic-4-retro-2026-03-12.md] — Décision produit : suppression type/subtype
- [Source: apps/backend/database/migrations/0005_create_positionings_table.ts] — Pattern migration à suivre
- [Source: apps/backend/app/models/positioning.ts] — Pattern model Lucid
- [Source: apps/backend/tests/functional/positionings/schema.spec.ts] — Pattern tests fonctionnels schema
- [Source: packages/shared/src/types/positioning.ts] — Pattern types partagés
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — Naming, forUser scope, soft-delete
- [Source: _bmad-output/project-context.md#Data Patterns] — SoftDeletes + sous-ressources checklist

### Git Intelligence Summary

Commits récents :
- `e4faa6f` BMAD: epic 4 review & small changes
- `003465a` feat(positionings): add E2E tests
- `13b7f85` feat(positionings): add restore functionality for soft-deleted positionings

Pattern établi : chaque story backend-only génère un commit `feat(interactions): ...`.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Migration `0006_create_interactions_table.ts` créée et appliquée avec succès — table `interactions` avec toutes les colonnes, FKs, et 3 index composites
- Model `Interaction` créé avec `compose(BaseModel, SoftDeletes)`, `forUser` scope, et relations `belongsTo` (User, Prospect, Positioning)
- Models `Prospect`, `User`, `Positioning` mis à jour avec `@hasMany(() => Interaction)` (sans circular import issues grâce aux lazy arrow functions Lucid)
- Types partagés créés dans `packages/shared/src/types/interaction.ts` et exportés dans `index.ts` — build réussi
- 10 tests fonctionnels couvrant tous les ACs (création, isolation forUser, soft-delete, withTrashed, FK nullables, ON DELETE SET NULL)
- 169/169 tests passent (159 existants + 10 nouveaux), 0 erreurs Biome, 0 erreurs TypeScript

### File List

- `apps/backend/database/migrations/0006_create_interactions_table.ts` (created)
- `apps/backend/app/models/interaction.ts` (created)
- `apps/backend/app/models/prospect.ts` (modified)
- `apps/backend/app/models/user.ts` (modified)
- `apps/backend/app/models/positioning.ts` (modified)
- `apps/backend/tests/functional/interactions/schema.spec.ts` (created)
- `packages/shared/src/types/interaction.ts` (created)
- `packages/shared/src/index.ts` (modified)
