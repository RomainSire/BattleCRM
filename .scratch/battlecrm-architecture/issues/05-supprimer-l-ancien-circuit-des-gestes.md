# 05: Supprimer l'ancien circuit des gestes

**What to build:** plus aucun geste n'utilise l'ancien circuit, on peut donc le supprimer. Le module Geste ne connaît plus ni les sortes de gestes, ni les sujets des autres modules : chaque module déclare les siens, et le raccordement des inverses ne se fait plus à la main dans l'assemblage de l'app. Ajouter un sujet, comme la Battle à l'issue 27 de l'implémentation, ne demandera plus de modifier le module Geste. Sources : revue d'architecture du 2026-10-15 (piste 1) ; ADR 0011.

**Blocked by:** 03, 04

**Status:** resolved

- [x] Plus de types en double par sujet (inverse, table des inverses), plus d'alias de verrou par sujet, plus de test « est-ce une sorte de Positionnement ? »
- [x] La liste des sortes de gestes de chaque module vit dans ce module, et non plus dans le module Geste
- [x] L'assemblage de l'app ne raccorde plus les inverses geste par geste
- [x] Il ne reste plus qu'une seule table des statuts de refus (hors auth, voir le commentaire)
- [x] La table des gestes n'est pas modifiée. Si un nouveau sujet doit un jour y être référencé, la migration se fera en expand–contract, avec son geste
- [x] Les tests existants de l'API restent verts ; l'utilitaire d'annulation des tests de l'API n'est plus redéfini dans chaque fichier
- [x] `pnpm check` vert

## Comments

**2026-10-15, implémentation (agent).**

- **Ancien circuit supprimé** (`gestures/index.ts`) : `Inverse`, `PositioningInverse`, `Inverses`, `PositioningInverses`, `lockPositioning`, `recordGesture`, l'union `Subject`, `isPositioningKind` et `oldInverse`. Il reste un seul verrou, `lockSubject`, et un seul enregistrement, `record`. Annuler retrouve le geste déclaré par sa sorte, puis lit la colonne de son sujet.
- **Les sortes vivent dans leur module** : `CONTACT_GESTURE_KINDS` est dans `prospecting/tables.ts`, et `POSITIONING_GESTURE_KINDS` dans `funnel/tables.ts`.
  - `gestures/tables.ts` les importe seulement pour sa colonne `kind` et ses contraintes. drizzle-kit charge les fichiers de tables seuls.
  - Le module Geste tire `GestureKind` de la colonne `kind`, et `SubjectColumn` des colonnes uuid facultatives de `gesture`. Il ne nomme plus aucun sujet.
  - La table n'est pas modifiée : mêmes valeurs dans le même ordre, et `pnpm --filter @battlecrm/api db:drift` ne voit aucun changement. Aucune migration.
- **Assemblage** : `app.ts` ne passe plus que `gestures: [...prospecting.gestures, ...positionings.gestures]`. Une sorte sans geste déclaré ne compile pas (`Covering`), et l'erreur nomme les sortes manquantes.
- **Refus** : côté gestes, `REFUSAL_STATUS` était déjà la seule table depuis les tickets 03 et 04. Les tables de l'auth (`REAUTHENTICATION_STATUS`, `PASSWORD_REFUSAL_STATUS`, les tables en ligne de `auth/index.ts`) restent en place, et c'est voulu. `invalid_code` y répond 401 (code de connexion), 400 (activation de la double authentification) ou 403 (réinitialisation du mot de passe), et la SPA lit ces statuts. Les réunir changerait des réponses, ce qui va contre l'expand–contract. Si on veut les réunir, il faut un ticket à part, avec la SPA.
- **Tests** : `test/factories/gesture.ts` exporte `undo` et `undone`, que les 10 fichiers de test utilisent à la place de leurs copies. Les tests de l'atelier lisent désormais la `Response`, comme les autres. Aucune assertion n'est changée.
- **Reste à faire** : `Touched` nomme encore les lignes du résumé (Contacts, Organisations, Positionnements). C'est la forme du résumé de travail, pas le circuit : elle relève du ticket 08.
