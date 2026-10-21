# 28: Tirage et Essai

**What to build:** quand l'Étape d'un Contact En prospection a une Battle ouverte, le geste central révèle le Positionnement tiré au sort (« tiré au sort », avec la raison), qui reste réservé au Contact ; « C'est envoyé » commence un Essai. L'Utilisateur peut déroger (« J'ai utilisé <l'autre> à la place »), c'est tracé. Les cas sans Essai proposent le Champion avec la raison. Sources : spec UX §6.1 ; CONTEXT (Tirage, Essai) ; ADR 0002, 0011 ; spec stack §5.3 ; ST-34.

**Blocked by:** 25, 27

**Status:** resolved

- [x] `chooseAssignment(counts, random)` dans `packages/domain` : le Positionnement qui a le moins d'Essais et de Tirages réservés parmi les Contacts de la même Cible, hasard en cas d'égalité, jamais un Positionnement à l'Horizon ; testé par fast-check
- [x] Dans `prospecting` : hasard `crypto.randomInt` (injecté), `SELECT … FOR UPDATE` sur la Battle, Tirage stocké (Contact, Battle, Positionnement) ; rouvrir le geste ou « Plus tard » montre le même ; le Tirage révélé survit à « Annuler »
- [x] Le Tirage tombe quand la Battle est close ou que le Contact quitte l'Étape ou En prospection (branchement aux tickets 19, 30, 32)
- [x] Essai : commence à la date de l'utilisation, retient la Cible du moment, au plus un en cours par Contact et un par Battle (index uniques partiels) ; dérogation avec motif facultatif, badge « ton choix »
- [x] Garde-fous : Essai en cours ailleurs (le régler d'abord, ticket 29) ; déjà un Essai dans cette Battle (choix libre, sans Essai) ; Contact déjà exposé (information) ; hors Cible d'une Battle restreinte ou Horizon atteint des deux côtés (Champion proposé, sans Essai, raison)
- [x] Un Positionnement devient figé à son premier Essai (atelier, ticket 23) ; le récapitulatif dit « Essai commencé »
- [x] Tests : équilibrage, concurrence sur la Battle, Annuler supprime l'Essai mais garde le Tirage

## Comments

**2026-10-21, implémentation (agent).**

- **`packages/domain`** : `chooseAssignment(candidates, random)` (le moins chargé parmi ceux sous l'Horizon, le hasard départage, `undefined` si tous l'ont atteint), testé par fast-check (écart jamais supérieur à 1, toujours un des plus légers).
- **API** (`prospecting`, `trials.ts`) : tables `assignment` (Tirage : Contact, Battle, Positionnement, Cible du moment ; au plus un par Contact) et `trial` (Essai : utilisation qui l'a commencé, donc sa date ; Cible du moment ; `overridden` et motif ; issue et motif d'annulation pour le ticket 29 ; index uniques partiels « un en cours par Contact » et « un compté par Battle », annulés à part). Migrations `0031_trials` (RLS levée le temps des clés étrangères) et `0032_trials_access` (RLS forcée), appliquées à la base de dev.
  - `POST /contacts/:id/reveal-assignment`, hors geste : verrou du Contact, Battle verrouillée (`battles.openBattleToAssignAt`, `FOR UPDATE`), Tirage réservé ou choisi (`crypto.randomInt` injecté) ; sinon `withoutTrial` : `already_tried`, `off_target`, `horizon`, `trial_in_progress` ; 409 `not_in_battle`.
  - `use-positioning` : `overrideReason` facultatif ; Essai commencé pour un Contact En prospection, Positionnement de la Battle, sous l'Horizon ; dérogation si ce n'est pas le Tirage (motif gardé seulement alors). Refus : 409 `assignment_required` (Tirage pas encore révélé), 409 `trial_in_progress`. « Annuler » supprime l'Essai, garde le Tirage.
  - Un Tirage réservé dont le Positionnement a atteint l'Horizon passe à l'autre, sans hasard (trouvé en revue). Un Tirage resté d'une autre Battle tombe au Tirage suivant.
- **Le Tirage tombe** :
  - En quittant En prospection (ticket 19), le Tirage tombe et « Annuler » le rend. `dropAssignment` est prêt pour le changement d'Étape (30).
  - Pour la clôture (32), le Tirage resté tombe de lui-même au Tirage suivant. Il restera à annuler les Essais en cours (« Battle clôturée »).
  - Un Tirage révélé ferme le retour de l'Entrée dans le Funnel, de l'ajout du Contact et de l'ouverture de la Battle (`superseded`) : `battles` reçoit `battleAssignments` par la racine de composition.
- **Figé** : `funnel` reçoit `positioningUses.inTrial`. Modifier le Positionnement, joindre ou retirer une pièce jointe : 409 `frozen`, et leur « Annuler » répond `superseded` une fois figé. Le résumé compte `trialCount`.
- **Résumé** : chaque Contact porte `assignment` et `trial` (en cours). **Contrat** : `TRIAL_OUTCOMES`, `WITHOUT_TRIAL_REASONS`, `OVERRIDE_REASON_MAX_LENGTH`, `assignmentRevealed`.
- **SPA** (`contacts/use-positioning.tsx`) :
  - Ligne « Étape X · Battle A contre B ».
  - Tirage demandé au serveur à chaque ouverture (« Tirage au sort… », « Réessayer »).
  - Positionnement tiré avec le badge « tiré au sort » et sa raison. « J'ai utilisé « B » à la place » passe le badge à « ton choix » et ouvre un motif facultatif, avec « Revenir au tirage ».
  - Sans Essai possible : la raison, Champion proposé, choix libre. Essai en cours ailleurs : rien à envoyer.
  - « Déjà exposé à « X » le … » d'après le fil.
  - Récapitulatif « Essai commencé » (« avec dérogation »). Notification « Envoyé à … : « … », Essai commencé. Relance 1 le … ».
  - Vivier ou Archivé à une Étape à Battle ouverte : « Faire entrer et continuer » passe par « Changer d'État », puis le Tirage s'affiche.
  - « Changer d'État » : avec un Essai en cours, quitter En prospection est bloqué, avec le message.
  - Atelier : refus « figé » dit comme tel.
- **Revue** :
  - Tirage à l'Horizon passé à l'autre.
  - Tirage resté d'une autre Battle.
  - Test de deux utilisations simultanées juste avant l'Horizon.
  - « Annuler » qui rend la Battle touchée.
  - Le terme « draw », proscrit par le glossaire, est retiré du code et des textes anglais.
- **Base de dev** : 0029/0030 y étaient enregistrées depuis un brouillon du ticket 27, avec d'autres horodatages : le migrateur voulait rejouer 0029. J'ai vérifié que le schéma était identique à celui des migrations commitées (base jetable comparée par `pg_dump`), puis réaligné `drizzle.__drizzle_migrations` (hash et `created_at`).
- **Laissé aux tickets suivants** :
  - Régler l'Essai : dans « A répondu… », en quittant En prospection (aujourd'hui refusé), l'Essai en cours ailleurs réglé dans le geste (29).
  - Écarts à la Cadence tracés sur l'Essai, dont « modifier » la Relance 1 pendant un Essai (29).
  - Tirage qui tombe au changement d'Étape (30).
  - Essais en cours annulés et Tirages tombés à la clôture (32).
  - Fil et bloc Essai de la fiche (29).
- **À trancher** :
  - Un Essai annulé ne bloque pas un nouvel Essai dans la même Battle (index partiel). CONTEXT dit « jamais deux Essais dans la même Battle ».
  - Un Positionnement utilisé qui a atteint l'Horizon ne commence pas d'Essai, même si l'autre ne l'a pas atteint. Le récapitulatif d'une dérogation vers celui-là annonce quand même « Essai commencé » ; la notification dit vrai.
  - `trialCount` compte aussi les Essais annulés (figé dès le premier).
  - `assignment_required` est un refus, quand l'ADR 0002 dit « l'app ne refuse rien » (pensé pour la dérogation). Une SPA d'avant le ticket 28 l'obtient à une Étape à Battle ouverte.

