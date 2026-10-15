# 06: La SPA envoie un geste par un seul module, prouvé sur les écrans Contact

**What to build:** aujourd'hui, chaque envoi de geste de la SPA refait les mêmes étapes :
- vérifier les statuts de refus ;
- réinterpréter le corps de la réponse ;
- lever une erreur générique ;
- appliquer les lignes modifiées au résumé de travail, ou bien le relire ;
- afficher le toast Annuler.

Ce ticket les rassemble dans un seul module de la SPA. Ce module reçoit l'appel. Il renvoie un refus typé, dans la forme commune du ticket 02, ou bien il applique les lignes renvoyées et affiche le toast avec son jeton d'annulation. Les cinq écrans Contact l'utilisent : la Relance, les Interactions, le changement d'État, l'ajout rapide et les coordonnées. Pour l'Utilisateur, rien ne change. Sources : revue d'architecture du 2026-10-15 (piste 2) ; ADR 0011, 0012.

**Blocked by:** 03

**Status:** resolved

- [x] Un module de la SPA envoie un geste : il renvoie un refus typé, ou applique les lignes modifiées et affiche le toast Annuler avec le jeton
- [x] Les codes de refus sont typés depuis la réponse de l'API : renommer un code côté serveur casse la compilation de l'écran qui le traite
- [x] Les écrans Relance, Interactions, changement d'État, ajout rapide et coordonnées passent par ce module ; ils ne gardent que le message de succès et leur réaction à chaque refus
- [x] Plus de copie locale du traitement des refus ni du règlement d'un geste dans ces écrans
- [x] Toute erreur montrée à l'Utilisateur passe toujours par `ErrorMessage` ou `FieldErrorMessage`
- [x] Les tests existants de ces écrans restent verts sans modification de comportement
- [x] `pnpm check` vert

## Comments

**2026-10-15, implémentation (agent).**

- **Module** (`apps/web/src/gesture.ts`) : `sendGesture(queryClient, requête, message)` et le hook `useSendGesture()`. Il reçoit l'appel du client hc et attend la réponse.
  - Geste fait : il applique les lignes renvoyées au résumé (`applySummaryChanges`) et affiche le toast Annuler avec le jeton, si `message(changes)` dit quelque chose. Il renvoie alors `undefined`.
  - Geste refusé (400, 404, 409, 413) : il relit le résumé et renvoie le refus, dans la forme commune du ticket 02.
  - `invalid` et tout autre statut lèvent une erreur : c'est une erreur de l'app, jamais de l'Utilisateur.
  - Testé seul dans `gesture.test.ts`.
- **Codes typés** : `RefusalOf<route>` tire les codes de la réponse de l'API (sans `invalid`). Un `===` ou un `case` sur un code renommé ne compile plus (vérifié avec `change-status` et `quick-add`). Seuls les statuts de refus sont recopiés à la main (`REFUSAL_STATUSES`), car la SPA n'importe pas de valeur de l'API.
- **Écrans** : Relance (tête du fil, Planifier, Relancer…), Interactions (Noter, A répondu…), changement d'État, ajout rapide, coordonnées. Chacun ne garde que son message de succès et sa réaction aux refus (`refusalText`, `isStageGone`). `settle`, `refusalOf` et les objets `send` locaux sont supprimés.
- **Comportement** : aucun test modifié. Un seul écart, invisible pour l'Utilisateur : dans l'ajout rapide, `unknown_organization` et `not_found` relisent maintenant le résumé, en gardant le message générique d'avant.
- **Focus** (`contact-record.tsx`) : quand on enregistre les Coordonnées, le toast part maintenant avant la fin de la mutation. Le `requestAnimationFrame` arrivait alors avant le retour du bouton « Modifier », et le focus était perdu. `flushSync` rend le bouton, puis lui donne le focus : le résultat ne dépend plus du timing.
- **Reste** : l'atelier, les pièces jointes et la page Organisation gardent leur propre traitement, jusqu'au ticket 07. Il faudra alors un geste sans jeton, donc sans toast Annuler.
