# 04: Les gestes de l'atelier des Positionnements passent par le module Geste, et les refus des Organisations prennent la forme commune

**What to build:** les 8 gestes annulables sur un Positionnement passent par le circuit commun posé au ticket 02 :
- créer ;
- faire une copie modifiée ;
- modifier ;
- corriger le libellé ;
- archiver ;
- supprimer ;
- joindre une pièce jointe ;
- retirer une pièce jointe.

Les pièces jointes retirées sont toujours purgées dans le même circuit. Les 4 gestes d'Organisation (renommer, changer le type, fusionner, supprimer) ne s'annulent pas et restent hors du circuit, mais ils refusent dans la forme commune. Pour l'Utilisateur, rien ne change. Sources : revue d'architecture du 2026-10-15 (piste 1) ; ADR 0011.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Chacun des 8 gestes de l'atelier passe par le circuit commun, son inverse déclaré à côté de lui
- [ ] Les refus de l'atelier prennent la forme commune ; sa table de statuts propre n'est plus utilisée
- [ ] Les gestes d'Organisation refusent dans la forme commune, sans renvoyer de valeurs ad hoc
- [ ] Un seul utilitaire valide l'identifiant d'un sujet (fini les copies de l'atelier et des Organisations)
- [ ] Les tests existants de l'atelier, des pièces jointes, des Organisations et d'Annuler restent verts sans modification de comportement
- [ ] `pnpm check` vert
