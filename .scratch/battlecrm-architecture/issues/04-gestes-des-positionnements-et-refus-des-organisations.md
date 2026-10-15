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

**Status:** resolved

- [x] Chacun des 8 gestes de l'atelier passe par le circuit commun, son inverse déclaré à côté de lui
- [x] Les refus de l'atelier prennent la forme commune ; sa table de statuts propre n'est plus utilisée
- [x] Les gestes d'Organisation refusent dans la forme commune, sans renvoyer de valeurs ad hoc
- [x] Un seul utilitaire valide l'identifiant d'un sujet (fini les copies de l'atelier et des Organisations)
- [x] Les tests existants de l'atelier, des pièces jointes, des Organisations et d'Annuler restent verts sans modification de comportement
- [x] `pnpm check` vert

## Comments

**2026-10-15, implémentation (agent).**

- **Les 8 gestes de l'atelier** passent par le circuit commun, chacun déclaré avec son inverse dans `funnel/positionings.ts` : créer et faire une copie modifiée (une `Creation`, sorte `positioning_created`), modifier, corriger le libellé, archiver, désarchiver, supprimer, joindre et retirer une pièce jointe. Les routes ne font plus que valider la requête et appeler le circuit. `app.ts` passe `positioningInverses: {}`.
- **Trois ajouts au circuit, sans branche par sujet** :
  - `GestureSubject.forgetExpired` : ce qu'un geste sur ce sujet oublie en chemin, une fois hors de portée d'Annuler. Le sujet Positionnement y déclare `purgeRemovedAttachments` : les pièces jointes retirées sont toujours purgées, à chaque geste de l'atelier, après ses écritures et avant son enregistrement.
  - `GestureSubject.of` : quand une route nomme le sujet par une de ses lignes. « Retirer une pièce jointe » nomme la pièce jointe, et le circuit verrouille son Positionnement. `Performed.namedId` donne au geste l'identifiant nommé par la route.
  - `perform(c, geste, entrée, 201)` : « joindre une pièce jointe » répond toujours 201.
- **Refus** : la table de statuts de l'atelier est supprimée. `REFUSAL_STATUS` reçoit `invalid`, `unknown_positioning`, `too_large`, `archived`, `not_archived`, `quota_exceeded` et `has_contacts`, avec leurs statuts inchangés. Les 4 gestes d'Organisation restent hors du circuit, mais renvoient `refusal(...)` et répondent par `answerRefusal`. Plus de `null`, de `'taken'` ni de `{ refused }`.
- **Identifiant** : `route-id.ts` (`idOf`) est le seul validateur. Il remplace les copies de l'atelier, des Organisations, du circuit, d'Annuler, de la fiche Contact (`views`) et de la révocation d'une session (`auth`). Ces deux dernières routes gardent leurs réponses.
- **Compatibilité** : sortes de gestes et formes retenues inchangées (`{}` pour créer et archiver, `attachmentIds` toujours facultatif). Les gestes enregistrés par la version précédente s'annulent toujours. Ordre des vérifications conservé, y compris l'identifiant avant le fichier sur la route des pièces jointes. Aucun test modifié, aucune migration.
- L'ancien circuit côté Positionnement (`recordGesture`, `lockPositioning`, `PositioningInverse(s)`, la branche Positionnement de `oldInverse`) n'a plus d'utilisateur. Il sera supprimé au ticket 05.
