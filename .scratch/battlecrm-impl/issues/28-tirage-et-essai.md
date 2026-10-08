# 28: Tirage et Essai

**What to build:** quand l'Étape d'un Contact En prospection a une Battle ouverte, le geste central révèle le Positionnement tiré au sort (« tiré au sort », avec la raison), qui reste réservé au Contact ; « C'est envoyé » commence un Essai. L'Utilisateur peut déroger (« J'ai utilisé <l'autre> à la place »), c'est tracé. Les cas sans Essai proposent le Champion avec la raison. Sources : spec UX §6.1 ; CONTEXT (Tirage, Essai) ; ADR 0002, 0011 ; spec stack §5.3 ; ST-34.

**Blocked by:** 25, 27

**Status:** ready-for-agent

- [ ] `chooseAssignment(counts, random)` dans `packages/domain` : le Positionnement qui a le moins d'Essais et de Tirages réservés parmi les Contacts de la même Cible, hasard en cas d'égalité, jamais un Positionnement à l'Horizon ; testé par fast-check
- [ ] Dans `prospecting` : hasard `crypto.randomInt` (injecté), `SELECT … FOR UPDATE` sur la Battle, Tirage stocké (Contact, Battle, Positionnement) ; rouvrir le geste ou « Plus tard » montre le même ; le Tirage révélé survit à « Annuler »
- [ ] Le Tirage tombe quand la Battle est close ou que le Contact quitte l'Étape ou En prospection (branchement aux tickets 19, 30, 32)
- [ ] Essai : commence à la date de l'utilisation, retient la Cible du moment, au plus un en cours par Contact et un par Battle (index uniques partiels) ; dérogation avec motif facultatif, badge « ton choix »
- [ ] Garde-fous : Essai en cours ailleurs (le régler d'abord, ticket 29) ; déjà un Essai dans cette Battle (choix libre, sans Essai) ; Contact déjà exposé (information) ; hors Cible d'une Battle restreinte ou Horizon atteint des deux côtés (Champion proposé, sans Essai, raison)
- [ ] Un Positionnement devient figé à son premier Essai (atelier, ticket 23) ; le récapitulatif dit « Essai commencé »
- [ ] Tests : équilibrage, concurrence sur la Battle, Annuler supprime l'Essai mais garde le Tirage
