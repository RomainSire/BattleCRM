import vine from '@vinejs/vine'

// ─────────────────────────────────────────────────────────────────────────────
// Validation de l'import (restauration des données utilisateur).
//
// Deux validateurs :
//   1. `importFileValidator` — présence + extension + taille du fichier uploadé.
//   2. `backupEnvelopeValidator` — structure de l'enveloppe décompressée/parsée
//      (format/version littéraux, blocs `account` et `data` par entité).
//
// Tout échec de `backupEnvelopeValidator` ⇒ 422 (géré globalement par Vine).
// L'isolation (userId forcé) est appliquée côté service, pas ici : le dump n'a
// volontairement pas de `userId` (champs inconnus ignorés par Vine de toute façon).
// ─────────────────────────────────────────────────────────────────────────────

// Fichier uploadé : présence + taille seulement. On NE valide PAS `extnames` ici :
// AdonisJS déduit l'extension via les magic-bytes du contenu, donc un gzip corrompu
// échouerait `extnames` (→ 422) avant le contrôleur. L'intégrité réelle (gzip décompressable
// + JSON valide) est vérifiée par le contrôleur via try/catch → `400` sur fichier corrompu.
export const importFileValidator = vine.create(
  vine.object({
    file: vine.file({
      size: '20mb',
    }),
  }),
)

const funnelStageSchema = vine.object({
  id: vine.string().uuid(),
  name: vine.string(),
  position: vine.number(),
  createdAt: vine.string(),
  updatedAt: vine.string().nullable(),
  deletedAt: vine.string().nullable(),
})

const prospectSchema = vine.object({
  id: vine.string().uuid(),
  funnelStageId: vine.string().uuid(),
  name: vine.string(),
  company: vine.string().nullable(),
  linkedinUrl: vine.string().nullable(),
  email: vine.string().nullable(),
  phone: vine.string().nullable(),
  title: vine.string().nullable(),
  notes: vine.string().nullable(),
  createdAt: vine.string(),
  updatedAt: vine.string().nullable(),
  deletedAt: vine.string().nullable(),
})

const positioningSchema = vine.object({
  id: vine.string().uuid(),
  funnelStageId: vine.string().uuid(),
  name: vine.string(),
  description: vine.string().nullable(),
  content: vine.string().nullable(),
  createdAt: vine.string(),
  updatedAt: vine.string().nullable(),
  deletedAt: vine.string().nullable(),
})

const stageTransitionSchema = vine.object({
  id: vine.string().uuid(),
  prospectId: vine.string().uuid(),
  fromStageId: vine.string().uuid().nullable(),
  toStageId: vine.string().uuid(),
  transitionedAt: vine.string(),
  createdAt: vine.string(),
})

const prospectPositioningSchema = vine.object({
  id: vine.string().uuid(),
  prospectId: vine.string().uuid(),
  positioningId: vine.string().uuid(),
  funnelStageId: vine.string().uuid(),
  outcome: vine.enum(['success', 'failed']).nullable(),
  createdAt: vine.string(),
})

const interactionSchema = vine.object({
  id: vine.string().uuid(),
  prospectId: vine.string().uuid(),
  positioningId: vine.string().uuid().nullable(),
  funnelStageId: vine.string().uuid(),
  notes: vine.string().nullable(),
  interactionDate: vine.string(),
  createdAt: vine.string(),
  updatedAt: vine.string().nullable(),
})

const battleSchema = vine.object({
  id: vine.string().uuid(),
  funnelStageId: vine.string().uuid(),
  variantAId: vine.string().uuid(),
  variantBId: vine.string().uuid(),
  battleNumber: vine.number(),
  status: vine.enum(['active', 'closed']),
  winnerId: vine.string().uuid().nullable(),
  startedAt: vine.string(),
  closedAt: vine.string().nullable(),
  createdAt: vine.string(),
  updatedAt: vine.string().nullable(),
})

export const backupEnvelopeValidator = vine.create(
  vine.object({
    format: vine.literal('battlecrm-backup'),
    version: vine.literal(1),
    exportedAt: vine.string(),
    account: vine.object({
      email: vine.string(),
      createdAt: vine.string(),
    }),
    data: vine.object({
      funnelStages: vine.array(funnelStageSchema),
      prospects: vine.array(prospectSchema),
      positionings: vine.array(positioningSchema),
      prospectStageTransitions: vine.array(stageTransitionSchema),
      prospectPositionings: vine.array(prospectPositioningSchema),
      interactions: vine.array(interactionSchema),
      battles: vine.array(battleSchema),
    }),
  }),
)
