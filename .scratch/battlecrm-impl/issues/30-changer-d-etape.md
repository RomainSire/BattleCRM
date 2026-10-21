# 30: Changer d'Étape

**What to build:** l'Utilisateur fait avancer ou reculer un Contact En prospection d'Étape par une fenêtre de conséquences (pastille d'Étape de la fiche, `E`) qui règle l'Essai en cours, propose d'enchaîner sur le geste central si l'Étape d'arrivée a une Battle ouverte, signale un recul, et propose « Ajouter au Cercle » après un Succès à la dernière Étape. Sources : spec UX §6.6, §6.2 (Et ensuite) ; CONTEXT (Funnel, Étape, Taux de passage) ; ADR 0003 ; ST-33.

**Blocked by:** 29, 19

**Status:** resolved

- [x] Changement d'Étape enregistré comme Interaction (ni sortante ni entrante) avec les positions de départ et d'arrivée dans l'ordre du Funnel du moment
- [x] Essai en cours : rappel du Critère, Succès proposé si le Contact avance, Laisser en cours s'il recule ; Essai réglé → « Annuler la Relance n planifiée » (cochée)
- [x] Battle ouverte à l'arrivée → « Enchaîner : utiliser un Positionnement maintenant » (cochée) ; sinon une ligne sur les Positionnements disponibles
- [x] Dernière Étape : un Succès propose « Ajouter au Cercle » (présélectionné) ou « Rester En prospection à <Étape> » ; même proposition dans « A répondu… » (« Avancer à <suivante> si Succès »)
- [x] Le Tirage réservé tombe quand le Contact quitte l'Étape ; seul un Contact En prospection change d'Étape
- [x] Geste testé (nominal + Annuler) ; réordonner le Funnel ensuite ne change pas le sens lu d'un changement passé

## Comments

**2026-10-21, implémentation (agent).**

- **`packages/domain`** : `stageMove(funnel, from, to)` donne les positions des deux Étapes dans le Funnel du moment et le sens (avance ou recul). `nextStageOf` donne l'Étape suivante. Les deux sont testés.
- **API** (`prospecting`) :
  - **Migrations** : `0035_stage_changes` crée la table `stage_change` (Interaction `stage_changed`, ni sortante ni entrante ; Étapes de départ et d'arrivée et leurs positions de l'époque, ST-33), avec la RLS levée le temps des clés étrangères. `0036_stage_changes_access` force la RLS. Les genres d'Interaction et de geste sont élargis. Les deux migrations sont appliquées à la base de dev.
  - **`POST /contacts/:id/change-stage`** (`{ stageId, trialOutcome?, cancelFollowUp? }`, geste `stage_changed`) :
    - Refus : 409 `not_prospecting`, 409 `same_stage`, 400 `unknown_stage` (Étape archivée ou inconnue).
    - Avec un Essai en cours, `trialOutcome` (`success`, `no_result`, `in_progress`) est obligatoire, sinon 409 `trial_in_progress`.
    - Le Tirage tombe.
    - « Annuler » rend l'Étape, le Tirage, l'Essai et la Relance. Il répond `superseded` si l'Étape quittée a été archivée depuis, ou si un Tirage a été révélé à la nouvelle Étape (trouvé en revue).
  - **« A répondu… »** :
    - Sans `status`, `stageId` déplace un Contact En prospection (`not_prospecting` sinon).
    - Après un Succès, `status: 'ally'` est accepté.
    - « Annuler » défait aussi le changement d'Étape.
  - **Fiche** : chaque entrée du fil porte `stageChange` (`fromStageId`, `toStageId`, `forward`). Le sens se lit dans les positions stockées : réordonner le Funnel ne le change pas (test, ADR 0003).
- **SPA** :
  - **Panneau « Changer d'Étape… »** (`contacts/change-stage.tsx`). Il s'ouvre par la pastille d'Étape, la touche `E` ou le menu `⋯`, et l'adresse le garde (`?stageTo=choose|<id>`). Il n'existe que pour un Contact En prospection.
    - L'Étape suivante est choisie par défaut. Chaque option dit « Avancer à… » ou « Revenir à… ». Le recul est signalé dans le récapitulatif.
    - Essai en cours : le Critère est rappelé, avec `1` `2` `3`. Succès est proposé si le Contact avance, Laisser en cours s'il recule.
    - Essai réglé : « Annuler la Relance n planifiée », cochée.
    - Succès à la dernière Étape : « Ajouter au Cercle » (présélectionné, envoyé comme changement d'État) ou « Rester En prospection à <Étape> ».
    - Battle ouverte à l'arrivée : « Enchaîner : utiliser un Positionnement maintenant », cochée, qui ouvre le geste central. Sinon, une ligne sur les Positionnements disponibles.
    - Notification « <Contact> avance à / revient à <Étape> », avec « Annuler ».
  - **« A répondu… »**, dans « Et ensuite » : l'Étape (« Avancer à <suivante> » après un Succès, « Rester à <Étape> » sinon, ou une autre), le Cercle après un Succès à la dernière Étape, l'enchaînement si l'Étape change vers une Battle ouverte.
  - **Fil** : « Étape : X → Y » ou « Recul : X → Y ».
- **Tests** :
  - domaine : `funnel.test.ts` ;
  - API (`change-stage.test.ts`) : nominal et « Annuler », refus, Essai, Tirage, réordonnancement, « A répondu… » ;
  - accès croisé et tables (`security.test.ts`) ;
  - SPA (`change-stage.test.tsx`) : les parcours, axe compris.
- **Revue** (normes et spec) :
  - corrigé : « Annuler » après un Tirage révélé à la nouvelle Étape (Tirage resté, ou 500 sur l'index unique) ;
  - corrigé : « step », proscrit par le glossaire, retiré des textes anglais ;
  - nettoyé : la doc et la duplication du libellé de Relance.
- **Laissé aux tickets suivants** : les autres déclencheurs (dépôt du kanban 33, table 34, palette 41). `stageTo=<id>` est prêt pour le dépôt.
- **À trancher** :
  - « Succès à la dernière Étape » est lu comme l'Étape de la Battle de l'Essai, celle où le Contact se trouve. Depuis la dernière Étape, tout changement est un recul : « Ajouter au Cercle » ignore alors l'Étape choisie, et « Rester » s'affiche avec l'Étape d'arrivée.
  - Dans « A répondu… », l'enchaînement n'est proposé que si l'Étape change.
  - L'API accepte `cancelFollowUp` même quand l'Essai reste en cours, et `ally` après tout Succès dans « A répondu… ». Seule la SPA restreint, comme le veut l'ADR 0002 (l'app ne refuse rien).
