# 06: La SPA envoie un geste par un seul module, prouvé sur les écrans Contact

**What to build:** aujourd'hui, chaque envoi de geste de la SPA refait les mêmes étapes :
- vérifier les statuts de refus ;
- réinterpréter le corps de la réponse ;
- lever une erreur générique ;
- appliquer les lignes modifiées au résumé de travail, ou bien le relire ;
- afficher le toast Annuler.

Ce ticket les rassemble dans un seul module de la SPA. Ce module reçoit l'appel. Il renvoie un refus typé, dans la forme commune du ticket 02, ou bien il applique les lignes renvoyées et affiche le toast avec son jeton d'annulation. Les cinq écrans Contact l'utilisent : la Relance, les Interactions, le changement d'État, l'ajout rapide et les coordonnées. Pour l'Utilisateur, rien ne change. Sources : revue d'architecture du 2026-10-15 (piste 2) ; ADR 0011, 0012.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Un module de la SPA envoie un geste : il renvoie un refus typé, ou applique les lignes modifiées et affiche le toast Annuler avec le jeton
- [ ] Les codes de refus sont typés depuis la réponse de l'API : renommer un code côté serveur casse la compilation de l'écran qui le traite
- [ ] Les écrans Relance, Interactions, changement d'État, ajout rapide et coordonnées passent par ce module ; ils ne gardent que le message de succès et leur réaction à chaque refus
- [ ] Plus de copie locale du traitement des refus ni du règlement d'un geste dans ces écrans
- [ ] Toute erreur montrée à l'Utilisateur passe toujours par `ErrorMessage` ou `FieldErrorMessage`
- [ ] Les tests existants de ces écrans restent verts sans modification de comportement
- [ ] `pnpm check` vert
