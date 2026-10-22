# 31: Règle de victoire et suivi d'une Battle

**What to build:** sur l'écran Battles, chaque Battle ouverte dit où elle en est par une phrase et une jauge (« X a n % de chances de faire mieux que Y, il en faut 85 % », « trop tôt », « concluante », « Horizon atteint ») ; son panneau a les onglets Suivi, Essais (issue modifiable en ligne), Par Cible et Historique. Sources : spec UX §5.5 ; CONTEXT (Règle de victoire, Horizon) ; ADR 0001, 0012 ; ST-45.

**Blocked by:** 28

**Status:** resolved

- [x] `evaluateWinRule(counts, threshold, horizon)` dans `packages/domain` : calcul exact sur deux lois Bêta (pas de Monte-Carlo), minimum 10 Essais terminés par Positionnement et 5 succès au total, Horizon sur les Essais commencés hors annulés ; tests de valeurs de référence et fast-check
- [x] Phrase selon l'état, équivalent textuel de la jauge (décorative) ; jauge grisée, hachurée, « indicatif » sous le minimum
- [x] Ligne de l'onglet Battles : mini-jauge, « n+n terminés · n succès », état (« Clôturer… » reporté au ticket 32, voir commentaire)
- [x] Suivi : bandeau, progression (terminés vers 10, commencés vers l'Horizon, succès vers 5), Critère, Cible, seuil, Horizon, date ; Essais : issue modifiable tant que la Battle est ouverte (geste annulable) ; Par Cible « à titre indicatif »
- [x] Point teal « Battle concluante » sur l'entrée Battles de la navigation

## Comments

**2026-10-22, implémentation (agent).**

- **`packages/domain`** (`win-rule.ts`) :
  - `evaluateWinRule(counts, threshold, horizon)` : P(Challenger meilleur) par la formule exacte d'Evan Miller sur deux lois Bêta (a priori uniforme), log-factorielles sommées, sans Monte-Carlo.
  - États : `too_early`, `in_progress`, `conclusive` (vainqueur `champion` ou `challenger`), `draw`, `not_enough_data` (Horizon atteint avec moins de 3 succès). Concluante l'emporte sur l'Horizon.
  - L'Horizon est atteint quand **les deux** Positionnements ont atteint l'Horizon en Essais commencés hors annulés, comme le Tirage (`withoutTrial('horizon')`).
  - Ce qui manque au minimum est renvoyé (`missing`). `finishedTrials` et `startedTrials` sont exportés.
  - Tests : valeurs de référence de la recherche (0,707 à 0,972), états, et fast-check (bornes, symétrie, monotonie, pas de verdict sous le minimum).
  - `BATTLE_MINIMUM_FINISHED` et `BATTLE_MINIMUM_SUCCESSES` viennent maintenant du domaine. `packages/contract` les réexporte et dépend donc de `@battlecrm/domain`.
- **API** :
  - **Résumé** : chaque Battle porte `trials: { champion, challenger }` (`successes`, `noResults`, `inProgress`, hors annulés). Ajout seul : `startedTrials` et `finishedTrials` restent.
  - **`GET /api/battles/:id/trials`** (`views`) : les Essais d'une Battle, le plus récent d'abord (Contact, Positionnement, jour de début, issue, Cible, motif d'annulation). Lu à la demande par le panneau, comme la fiche Contact. Une Battle d'un autre Utilisateur répond 404.
  - **`POST /api/trials/:id/change-outcome`** `{ outcome, cancelReason? }`, geste `trial_outcome_changed` avec « Annuler ».
    - Le sujet est le Contact de l'Essai (`subject.of`), car l'issue touche son Essai en cours.
    - Refus : 409 `battle_closed`, 409 `same_outcome`, 409 `not_prospecting` et 409 `trial_in_progress` (retour en cours), 409 `already_tried` (désannuler alors que le Contact a un autre Essai compté dans la Battle), 400 `invalid` (annulé sans motif).
    - Verrous dans l'ordre Battle (partagé) puis Essai, l'ordre que prendra la clôture.
    - « Annuler » répond `superseded` une fois la Battle close.
  - **Migration** `0037_trial_outcome_changed` : élargit les `CHECK` de `gesture` (compatible avec la version précédente). Appliquée à la base de dev.
- **SPA** :
  - **Ligne d'une Battle ouverte** : face-à-face, phrase, mini-jauge, « n+n terminés · n succès », état (« trop tôt », « en cours », « concluante », « Horizon atteint »). Toute la ligne ouvre son panneau (`?stage=…&panel=progress`) : le lien du nom de l'Étape s'étend sur la ligne (un seul arrêt de tabulation, cadre de focus autour de la ligne), avec un fond au survol et un chevron › (retour de Romain : cliquer sur le seul nom n'était pas assez intuitif).
  - **Panneau** ancré à droite (plein écran en largeur étroite), avec trois onglets :
    - **Suivi** : phrase, bandeau « Concluante » ou « Horizon atteint », jauge, progression (terminés vers 10, commencés vers l'Horizon, succès vers 5), Critère, Cible, seuil, Horizon, date.
    - **Essais** : issue changée par un menu tant que la Battle est ouverte, avec le rappel du Critère. « Annulé… » demande le motif. Notification avec « Annuler ».
    - **Par Cible** : « n succès sur m » par Cible et Positionnement, « à titre indicatif ».
  - **Phrase** (`battles/win-rule.tsx`) : l'équivalent textuel de la jauge, qui est décorative (`aria-hidden`). Le pourcentage est arrondi par défaut, pour ne jamais afficher le seuil avant qu'il soit atteint. « mène » seulement au-delà de 10 points d'écart à 50 %, comme le prototype.
  - **Jauge** : zones de seuil aux deux extrémités. Sous le minimum, elle est grisée, hachurée et marquée « indicatif tant que le minimum n'est pas atteint ».
  - **Point teal** sur l'entrée Battles de la barre latérale, libellé « Battle concluante » (texte masqué et infobulle).
- **Tests** :
  - domaine : `win-rule.test.ts` ;
  - API : `change-trial-outcome.test.ts` (résumé, lecture, nominal et « Annuler », refus, Annuler après clôture), `security.test.ts` (deux nouvelles routes) ;
  - SPA : `battle-follow.test.tsx` (phrases, états, point, panneau, issue changée et annulée, Par Cible, mobile, axe clair et sombre).
- **Revue** (standards et spec) :
  - Ordre des verrous corrigé.
  - « Annuler » refusé après clôture.
  - Jauge entièrement grisée sous le minimum.
  - Helpers dédoublonnés.
  - Panneau renommé `progress`.
  - Fenêtre d'annulation gardée ouverte sur un refus.
  - Motif d'annulation affiché.
  - « Confidence threshold » en anglais.
- **Laissé au ticket 32** (ajouté à sa liste) :
  - Le bouton « Clôturer… » sur la ligne et dans le bandeau, et « Clôturer quand même… » : sans fenêtre de clôture, il n'ouvrirait rien ; la ligne montre l'état à la place.
  - Le quatrième onglet « Historique » du panneau : aucun Verdict n'existe encore.
- **À trancher** :
  - `packages/contract` dépend désormais de `packages/domain` pour le minimum : à consigner, ou à revenir à une constante en double.
  - Désannuler un Essai n'est pas refusé à l'Horizon : il peut faire dépasser l'Horizon d'un Essai.
  - Un « égalité » peut s'afficher avec des Essais encore en cours à l'Horizon, qui pourraient rendre la Battle concluante ensuite.
