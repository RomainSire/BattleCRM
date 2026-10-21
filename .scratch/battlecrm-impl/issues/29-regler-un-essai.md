# 29: Régler un Essai

**What to build:** l'Utilisateur règle l'Essai en cours d'un Contact : dans « A répondu… » (Succès, Sans suite ou Laisser en cours, `1` `2` `3`, sans présélection), depuis un Essai « délai dépassé » (Sans suite, puis la proposition de remettre au Vivier, ou Relancer quand même), et en quittant En prospection. Sources : spec UX §5.3, §6.2, §6.7, §6.11 (quitter En prospection) ; CONTEXT (Essai, Délai de réponse, À traiter) ; ADR 0005 ; ST-34.

**Blocked by:** 28, 26, 22

**Status:** resolved

- [x] Signal « délai dépassé » calculé (Cadence épuisée ou arrêtée, Délai de réponse compté depuis la dernière Interaction sortante faite ou entrante) dans `packages/domain`, jamais stocké
- [x] A répondu… avec Essai : Positionnement, Battle, rappel du Critère, `1` `2` `3`, « Enregistrer la réponse » inactif tant que l'Essai n'est pas réglé ; Laisser en cours fait repartir le Délai de réponse depuis la réponse
- [x] Sans suite : notification « Essai sans suite : un point de donnée de plus pour la Battle “<Étape>” (14/20 terminés). », puis « Remettre <Contact> au Vivier ? … » (Remettre au Vivier présélectionné, Garder En prospection, Archiver), motif facultatif
- [x] Relancer quand même : Relance hors Cadence, écart tracé sur l'Essai ; changer la date d'une Relance pendant un Essai est aussi un écart tracé
- [x] Quitter En prospection (ticket 19) : l'Essai en cours doit être réglé (Succès vers Allié, Sans suite vers Vivier, aucun vers Archivé ; Annulé avec motif)
- [x] Bloc Prochaine action : Essai délai dépassé → Sans suite… ; en attente → A répondu… ; fiche : bloc Essai en cours
- [x] Gestes testés (nominal + Annuler)

## Comments

**2026-10-21, implémentation (agent).**

- **`packages/domain`** : `responseWindowEndsOn` et `isWindowElapsed` (`trial.ts`).
  - Le Délai de réponse se compte depuis la dernière Interaction faite, sortante ou entrante.
  - Le signal ne vaut que sans Relance planifiée. Toute Relance, de la Cadence ou ajoutée à la main, passe d'abord (tranché avec Romain).
  - Le signal s'affiche dès le dernier jour du délai, comme une Relance est due le jour même.
- **API** (`prospecting`) :
  - **Migrations** : `0033_trial_settled` ajoute `trial.settled_at` et la table `trial_deviation`, avec la RLS levée le temps de la clé étrangère. `0034_trial_deviation_access` force la RLS. Les deux sont appliquées à la base de dev.
  - **« A répondu… »** : `trialOutcome` (`success`, `no_result` ou `in_progress`). Après un Sans suite, `status` `pool` ou `archived` et `reason`. `trialOutcome` reste facultatif pour la SPA précédente : absent, l'Essai reste en cours.
  - **Changer d'État** : `trialOutcome` (`success`, `no_result` ou `canceled`) et `cancelReason`, obligatoire pour `canceled`. Sans issue, quitter En prospection reste refusé (`trial_in_progress`). Le règlement est retenu dans `statusChanged` : « Annuler » le défait partout où un changement d'État est repris.
  - **« Sans suite… »** : `POST /contacts/:id/settle-trial`, geste `trial_settled`. Il prend `outcome: no_result` puis, en option, `status` `pool` ou `archived` et `reason`. Refus 409 `no_trial` sans Essai en cours.
  - **Écarts** (nouveau terme du glossaire **Écart**, EN *Deviation*), défaits par « Annuler » :
    - `off_cadence_follow_up` : « Relancer quand même », soit `POST /follow-up` avec `anyway` quand rien n'est planifié. Une Relance hors Cadence est ajoutée, faite. Le geste demande un Essai en cours.
    - `follow_up_moved` : la date d'une Relance changée pendant un Essai (« Modifier la Relance », Reporter), ou la Relance 1 modifiée à l'envoi.
  - **Résumé** : chaque Battle porte `startedTrials` (hors annulés) et `finishedTrials` ; « 14/20 terminés » se lit terminés / commencés (tranché avec Romain).
- **SPA** :
  - **Bloc Prochaine action** : délai dépassé → **Sans suite…** et « Relancer quand même » ; en attente → **A répondu…**. Le texte dit « délai dépassé » ou « délai dépassé le <date> sans réponse ».
  - **Bloc Essai en cours** (page, et onglet Détails du panneau) : Positionnement (et dérogation), Battle et rôle, Critère, durée, délai, « A répondu… ».
  - **Champ d'issue** : touches `1` `2` `3`, sans présélection, actives hors des autres champs du panneau.
  - **« A répondu… »** :
    - Le Critère est rappelé, et « Enregistrer la réponse » reste inactif tant que l'Essai n'est pas réglé.
    - Après un Sans suite, la proposition « Remettre au Vivier » est présélectionnée, avec un motif facultatif.
    - Le récapitulatif donne la date de « délai dépassé » si l'Essai reste en cours.
  - **Panneau « Sans suite… »** (§6.7). Les notifications « Essai sans suite / réussi : un point de donnée de plus pour la Battle “<Étape>” (n/m terminés). » s'affichent aussi depuis « A répondu… » et Changer d'État.
  - **Changer d'État depuis En prospection** : Succès proposé vers le Cercle, Sans suite vers le Vivier, rien vers Archivé. Annulé demande un motif.
  - **Relancer quand même** : le panneau Relancer… en mode hors Cadence. « Modifier la Relance » signale l'écart pendant un Essai.
- **Tests** :
  - domaine : délai, bornes, Relance planifiée ;
  - API (`settle-trial.test.ts`) : chaque geste, « Annuler », refus, écarts ;
  - SPA (`trial.test.tsx`) : les parcours.
  - Le test du ticket 28 qui attendait un refus en quittant En prospection vérifie maintenant le règlement.
- **Revue** (normes et spec) :
  - ajouté : le terme Écart dans `CONTEXT.md` ;
  - réduit : `settle-trial` à Sans suite, seul usage demandé ;
  - corrigé : les touches `1 2 3` qui touchaient aux autres choix du panneau ;
  - ajouté : la notification de l'Essai réglé en Changer d'État ;
  - nettoyé : la duplication, les noms et le texte anglais.
- **Laissé aux tickets suivants** :
  - L'Essai en cours ailleurs, réglé dans le geste central (§6.1). Ce cas n'arrive qu'après un changement d'Étape (ticket 30).
  - « Et ensuite » côté Étape dans « A répondu… » (ticket 30).
  - Les Essais et leurs écarts dans le fil, et l'issue modifiable dans la Battle (ticket 31).
- **À trancher** :
  - La notification « Essai réussi : … » après un Succès n'est pas dans la microcopie §10. Elle suit le ton de « sans suite ».
  - `settle-trial` et `anyway` ne vérifient pas côté API que le délai est dépassé : l'app ne refuse rien (ADR 0002).

