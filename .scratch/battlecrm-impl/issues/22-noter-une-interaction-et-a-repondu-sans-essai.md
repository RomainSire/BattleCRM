# 22: Noter une Interaction et A répondu… sans Essai

**What to build:** l'Utilisateur note une Interaction sortante libre (appel, rencontre, message hors Positionnement, autre), ou enregistre qu'un Contact a répondu, sans nature positive ou négative ; pour un Contact du Vivier ou Archivé, la réponse propose de le faire entrer ou de l'ajouter au Cercle ; pour un Allié, ses Jours sans contact repartent. Sources : spec UX §6.2 (réponse spontanée), §6.4 ; CONTEXT (Interaction, Canal) ; ADR 0005 ; ST-36.

**Blocked by:** 21, 19

**Status:** resolved

- [x] Noter une Interaction (`I`) : type, date, note, récapitulatif « hors Activité » ; liens vers « A répondu… » et « Utiliser un Positionnement »
- [x] A répondu… : date, Canal, note facultative ; jamais de nature ; « Enregistrer la réponse » (`Entrée`)
- [x] Réponse spontanée : Vivier ou Archivé → « Laisser au Vivier » / « Laisser archivé » (présélectionné), « Faire entrer » (Étape et enchaînement comme au ticket 19) ou « Ajouter au Cercle » ; Allié → aucun choix d'État, lien « Planifier une Relance… »
- [x] « Et ensuite » : « Annuler la Relance planifiée » (cochée) ou « Planifier une Relance… »
- [x] Le résumé porte la dernière Interaction faite (sortante ou entrante) ; gestes testés (nominal + Annuler)

## Comments

**2026-10-14, implémentation (agent).**

- **API** (`prospecting`) : `interaction.channel` (Canal d'une réponse, `CHECK` qu'une réponse, et elle seule, en porte un), genres d'Interaction `call | meeting | message | other | reply`, gestes `interaction_noted` et `reply_recorded`. Migration `0023_interactions_and_replies` (colonne facultative, CHECK élargis : compatible avec la version précédente), appliquée à la base de dev. Deux gestes, chacun avec son inverse :
  - `POST /contacts/:id/note-interaction` `{ kind, occurredOn, note? }` : Interaction sortante, hors Activité, datée du jour saisi (ST-36) ; 400 `future_day` ; 409 `check_in_instead` sur un Allié (toute Interaction sortante libre auprès d'un Allié est une Prise de nouvelles, ticket 36). « Annuler » la supprime.
  - `POST /contacts/:id/record-reply` `{ occurredOn, channel, note?, cancelFollowUp?, status?, stageId? }` : Interaction entrante, sans nature (ADR 0005) ; annule la Relance planifiée si demandé (409 `no_follow_up` sinon) ; depuis le Vivier ou Archivé seulement, `status` fait entrer (Étape comme Changer d'État, 400 `stage_required` / `unknown_stage`) ou ajoute au Cercle, daté de maintenant (ST-39) ; 409 `no_status_choice` ailleurs. « Annuler » supprime la réponse, rend la Relance et l'État, sans Entrée.
  - Le cœur de Changer d'État est sorti en `changeStatus`, que la réponse réutilise ; `dayEntered` date les Interactions saisies (Relancer…, Noter, A répondu…) ; `onContact` passe État et Étape.
- **Résumé** : chaque Contact porte `lastDoneInteractionOn` (jour local de la dernière Interaction faite, sortante ou entrante : ce dont partent les Jours sans contact) ; le fil porte le Canal d'une réponse.
- **`CONTEXT.md`** : Interaction précise *reply* (Interaction entrante, la réponse du Contact) et *done* (Interaction faite) dans sa ligne `_EN_`. **`packages/contract`** : `CHANNELS`, `NOTED_INTERACTION_KINDS`, `INTERACTION_NOTE_MAX_LENGTH`.
- **SPA** (`contacts/interactions.tsx`) : panneaux ouverts dans l'adresse (`?interaction=note|reply`, ST-70), brouillon en `sessionStorage`. Noter une Interaction (`I`, bouton du bloc Prochaine action, jamais sur un Allié) : type, date (aujourd'hui, hier, une date passée), note, récapitulatif « Hors Activité », lien « A répondu… ». A répondu… (`⋯`, bouton secondaire sur la page) : date, Canal (E-mail par défaut tant qu'aucun Positionnement n'existe), note ; « Et ensuite » : Laisser au Vivier / Laisser archivé (présélectionné), Faire entrer (Étape) ou Ajouter au Cercle ; « Annuler la Relance du … » (cochée) ; « Planifier une Relance… » qui enchaîne sur le panneau de la Relance ; récapitulatif (Relance annulée, Entrée n°…, Cercle n/… avec prochaines nouvelles comptées depuis la réponse, « Jours sans contact comptés depuis le … »). Notifications : « Interaction notée avec … », « Réponse de … enregistrée » ou celle du changement d'État, avec « Annuler ». Fil : Appel, Rencontre, Message hors Positionnement, « A répondu · LinkedIn », avec leur note. `StageField`, `statusRecap`, `statusChangedMessage` (change-status) et `DoneDayField` (follow-up) partagés.
- **Revue** : `onContact` repris par Changer d'État et A répondu… (lecture du Contact dupliquée) ; « A répondu… » en bouton secondaire sur la page ; prochaines nouvelles d'un Allié ajouté au Cercle par une réponse antidatée comptées depuis la réponse ; termes *reply* et *done* consignés.
- **Laissé aux tickets suivants** : lien « Utiliser un Positionnement » et enchaînement après « Faire entrer » (25, 28) ; Canal prérempli avec celui du dernier Positionnement (25) ; Relance de Cadence décalée par une Interaction notée (26) ; Essai à régler et « État… » replié dans A répondu… pour un Contact En prospection (29) ; Prendre des nouvelles… sur un Allié (36) ; palette (41).
