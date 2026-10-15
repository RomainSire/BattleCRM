# 03: Les gestes de Prospection passent par le module Geste

**What to build:** les 7 autres gestes annulables sur un Contact passent par le circuit commun posé au ticket 02 :
- ajouter un Contact ;
- modifier le Contact ;
- changer d'État ;
- noter une Interaction ;
- A répondu… ;
- Relancer… ;
- annuler la Relance.

Pour l'Utilisateur, rien ne change : mêmes réponses, mêmes refus, même Annuler. Le module Prospection ne garde que ce qui varie d'un geste à l'autre. Sources : revue d'architecture du 2026-10-15 (piste 1) ; ADR 0011.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Chacun des 7 gestes passe par le circuit commun, son inverse déclaré à côté de lui
- [ ] Les refus de Prospection prennent la forme commune ; la classe de refus propre à Prospection, et ses `catch` répétés, ne sont plus utilisés par aucun geste
- [ ] L'enregistrement d'une Interaction et sa vérification ne sont plus répétés geste par geste
- [ ] Les tests existants de Prospection et d'Annuler restent verts sans modification de comportement
- [ ] `pnpm check` vert
