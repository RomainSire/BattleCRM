# 05: Supprimer l'ancien circuit des gestes

**What to build:** plus aucun geste n'utilise l'ancien circuit, on peut donc le supprimer. Le module Geste ne connaît plus ni les sortes de gestes, ni les sujets des autres modules : chaque module déclare les siens, et le raccordement des inverses ne se fait plus à la main dans l'assemblage de l'app. Ajouter un sujet, comme la Battle à l'issue 27 de l'implémentation, ne demandera plus de modifier le module Geste. Sources : revue d'architecture du 2026-10-15 (piste 1) ; ADR 0011.

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] Plus de types en double par sujet (inverse, table des inverses), plus d'alias de verrou par sujet, plus de test « est-ce une sorte de Positionnement ? »
- [ ] La liste des sortes de gestes de chaque module vit dans ce module, et non plus dans le module Geste
- [ ] L'assemblage de l'app ne raccorde plus les inverses geste par geste
- [ ] Il ne reste plus qu'une seule table des statuts de refus
- [ ] La table des gestes n'est pas modifiée. Si un nouveau sujet doit un jour y être référencé, la migration se fera en expand–contract, avec son geste
- [ ] Les tests existants de l'API restent verts ; l'utilitaire d'annulation des tests de l'API n'est plus redéfini dans chaque fichier
- [ ] `pnpm check` vert
