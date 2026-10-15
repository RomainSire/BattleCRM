# 07: L'atelier des Positionnements et la page Organisation passent par ce module

**What to build:** l'atelier des Positionnements, pièces jointes comprises, et la page Organisation envoient leurs gestes par le module du ticket 06. Un geste d'Organisation, qui ne s'annule pas, n'affiche pas de toast Annuler. Il ne reste plus aucun traitement des refus recopié dans les écrans. Pour l'Utilisateur, rien ne change. Sources : revue d'architecture du 2026-10-15 (piste 2).

**Blocked by:** 04, 06

**Status:** ready-for-agent

- [ ] Les gestes de l'atelier et des pièces jointes passent par le module ; la pièce jointe trop lourde reste un refus typé
- [ ] Les gestes de la page Organisation passent par le module, sans toast Annuler
- [ ] Plus aucune copie du traitement des refus ni du règlement d'un geste dans la SPA ; plus aucun code de refus relu comme une simple chaîne
- [ ] Les tests existants de l'atelier et de la page Organisation restent verts sans modification de comportement
- [ ] `pnpm check` vert
