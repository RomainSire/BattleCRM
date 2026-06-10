// Export / Import total des données utilisateur (sauvegarde & restauration).
// Enveloppe versionnée d'un dump gzippé (`.json.gz`).
//
// Chaque entité du dump = lignes brutes en camelCase, dates ISO 8601.
// `userId` est TOUJOURS omis du dump : redondant à l'export, re-forcé au compte
// authentifié à l'import (mécanisme d'isolation central de la feature).
//
// NB : package types-only (emitDeclarationOnly) → pas de constante runtime ici.
// Les valeurs `'battlecrm-backup'` / `1` sont définies côté backend.

export type BackupFunnelStage = {
  id: string
  name: string
  position: number
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
}

export type BackupProspect = {
  id: string
  funnelStageId: string
  name: string
  company: string | null
  linkedinUrl: string | null
  email: string | null
  phone: string | null
  title: string | null
  notes: string | null
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
}

export type BackupPositioning = {
  id: string
  funnelStageId: string
  name: string
  description: string | null
  content: string | null
  createdAt: string
  updatedAt: string | null
  deletedAt: string | null
}

export type BackupProspectStageTransition = {
  id: string
  prospectId: string
  fromStageId: string | null
  toStageId: string
  transitionedAt: string
  createdAt: string
}

export type BackupProspectPositioning = {
  id: string
  prospectId: string
  positioningId: string
  funnelStageId: string
  outcome: 'success' | 'failed' | null
  createdAt: string
}

export type BackupInteraction = {
  id: string
  prospectId: string
  positioningId: string | null
  funnelStageId: string
  notes: string | null
  interactionDate: string
  createdAt: string
  updatedAt: string | null
}

export type BackupBattle = {
  id: string
  funnelStageId: string
  variantAId: string
  variantBId: string
  battleNumber: number
  status: 'active' | 'closed'
  winnerId: string | null
  startedAt: string
  closedAt: string | null
  createdAt: string
  updatedAt: string | null
}

// Bloc `data` : ordre = parents → children (cohérent avec l'ordre d'insert à l'import).
export type BackupData = {
  funnelStages: BackupFunnelStage[]
  prospects: BackupProspect[]
  positionings: BackupPositioning[]
  prospectStageTransitions: BackupProspectStageTransition[]
  prospectPositionings: BackupProspectPositioning[]
  interactions: BackupInteraction[]
  battles: BackupBattle[]
}

// Métadonnée informative : la ligne `users` n'est ni exportée comme donnée à restaurer,
// ni modifiée à l'import. Seuls `email` + `createdAt` figurent dans l'enveloppe.
export type BackupAccount = {
  email: string
  createdAt: string
}

export type BackupEnvelope = {
  format: 'battlecrm-backup'
  version: 1
  exportedAt: string
  account: BackupAccount
  data: BackupData
}
