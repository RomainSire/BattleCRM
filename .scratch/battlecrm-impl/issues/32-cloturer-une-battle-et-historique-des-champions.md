# 32: Clôturer une Battle et Historique des Champions

**What to build:** l'Utilisateur clôt une Battle par une fenêtre qui présélectionne le Verdict de la Règle de victoire, lui permet de désigner un autre vainqueur après avertissement ou d'abandonner, annonce les conséquences et recueille un Enseignement ; l'onglet Historique des Champions montre ensuite la lignée de chaque Étape. Sources : spec UX §5.5, §6.9 (clôture), §10 ; CONTEXT (Verdict, Champion, Historique des Champions, Enseignement) ; ADR 0001.

**Blocked by:** 31

**Status:** resolved

- [x] Verdicts : victoire du Challenger, titre défendu, égalité, données insuffisantes, abandonnée ; « désigné par l'Utilisateur » quand la règle n'est pas satisfaite (case « Je désigne ce vainqueur quand même ») ; « Clôturer quand même… » sur une Battle non concluante
- [x] Conséquences dans une transaction : Champion, perdant archivé (« battu par … le … »), Challenger d'une Battle abandonnée laissé disponible, Essais en cours annulés « Battle clôturée » sans toucher aux Relances, Tirages réservés tombés
- [x] Confirmation, pas d'« Annuler » ; Enseignement facultatif, mis en avant pour égalité et données insuffisantes, modifiable ensuite
- [x] Microcopie de la spec UX §6.9 et §10 ; « Battu » n'est jamais un titre à l'écran
- [x] Historique des Champions : une lignée par Étape, Champion, date, Enseignement, Verdict sur les flèches ; prouvé (fond teal) / désigné (hachuré, pointillés) / titre conservé (neutre), écrit en toutes lettres, avec légende
- [x] « Clôturer… » sur la ligne de l'onglet Battles et dans le bandeau « Concluante » / « Horizon atteint » du Suivi, à la place du libellé d'état (reporté du ticket 31)
- [x] Onglet « Historique » du panneau d'une Étape (quatrième onglet, spec UX §5.5), et panneau d'une Étape sans Battle ouverte (reporté du ticket 31)
- [x] Mobile : consultation et clôture

## Comments

**2026-10-22, implémentation (agent).**

- **Décisions prises avec Romain** :
  - une égalité ou des données insuffisantes archivent le Challenger, comme le prototype 04 ; seule une Battle abandonnée le laisse disponible ;
  - modifier l'Enseignement après la clôture est un geste annulable (« Annuler »).
- **`packages/domain`** (`verdict.ts`) :
  - `VERDICTS` ;
  - `proposedVerdict(rule)`, le Verdict présélectionné ;
  - `judgeVerdict(rule, verdict)` dit si le Verdict est « désigné », ou refusé (égalité ou données insuffisantes que la règle ne constate pas) ;
  - `titleHolderAfter`, qui garde le titre, et `archivedBy`, qui est archivé.
  - `packages/contract` réexporte `VERDICTS`.
- **API** :
  - **Migration** `0038_battle_verdict`. Colonnes `closed_on`, `verdict`, `designated` et `takeaway`, avec leurs `CHECK` : Verdict et jour exactement une fois close, seul un vainqueur est désigné, Enseignement non vide et seulement sur une Battle close. Elle élargit aussi le `CHECK` de `gesture`. Ajout seul. Appliquée à la base de dev.
  - **`POST /api/battles/:id/close`** `{ verdict, designate?, takeaway? }`, une transaction sans « Annuler » :
    - le serveur juge le Verdict sur ses propres décomptes ;
    - refus : 409 `designation_required` (vainqueur contre la règle sans la case cochée), 409 `verdict_unsupported`, 409 `battle_closed`, 404 ;
    - le perdant est archivé ;
    - les Essais en cours passent en annulé avec le motif « Battle clôturée », dans la langue de l'Utilisateur, sans toucher aux Relances ;
    - les Tirages de la Battle tombent.
    - `prospecting` fournit les décomptes et la clôture des Essais par `battleAssignments` (`counts`, `close`).
    - Verrous : la Battle (`FOR UPDATE`), puis ses Essais. Régler un Essai (« A répondu… », « Sans suite… », quitter En prospection) prend désormais la Battle en partage d'abord, comme un changement d'issue.
  - **`POST /api/battles/:id/takeaway`** `{ takeaway }` : geste `battle_takeaway_changed`, avec « Annuler ». Refusé (409 `battle_open`) sur une Battle ouverte. Vide, il n'y a plus d'Enseignement.
  - **Champion d'une Étape** : le vainqueur du Verdict de sa dernière Battle, dans l'API (`championAt`) comme dans la SPA.
  - **« Annuler » fermé par la clôture** (`superseded`) :
    - pour les gestes qui ont commencé ou réglé un Essai de la Battle (`canUndoTrialIn`) ;
    - pour l'ouverture de la Battle.
  - **Résumé** :
    - la Battle porte `closedOn`, `verdict`, `designated` et `takeaway` ;
    - le Positionnement porte `archivedByBattle` `{ againstId, on, verdict }`, l'archivage par la clôture d'une Battle (même instant).
- **SPA** :
  - **« Clôturer… »** (contour d'accent) apparaît à deux endroits quand la Battle est concluante ou à l'Horizon :
    - sur la ligne, à la place du libellé d'état ;
    - dans le bandeau du Suivi.
  - **« Clôturer quand même… »** apparaît au bas du Suivi sinon.
  - L'adresse porte `panel=close` ; « Plus tard » ou la clôture ramènent au panneau de l'Étape.
  - **Fenêtre de clôture** :
    - le Verdict de la règle est présélectionné (« selon la Règle de victoire ») ;
    - un vainqueur contre la règle affiche un avertissement (minimum non atteint, seuil non atteint, ou la règle désigne l'autre) et la case « Je désigne ce vainqueur quand même » ;
    - abandonner rappelle que la Battle n'a rien appris ;
    - les conséquences reprennent la microcopie §10, le nouveau Champion d'abord ;
    - le nombre d'Essais en cours annulés est affiché ;
    - l'Enseignement est facultatif, mis en avant pour égalité et données insuffisantes ;
    - boutons « Clôturer » et « Plus tard ».
  - **Historique des Champions** : onglet de l'écran (`view=history`), quatrième onglet « Historique » du panneau, et panneau d'une Étape sans Battle ouverte (Champion, « Ouvrir une Battle… », Historique).
    - Une lignée par Étape, archivées comprises. Chaque case donne le Champion, la date et l'Enseignement (« Ajouter » ou « Modifier », avec « Annuler ») ; les flèches portent le Verdict.
    - Prouvé : bord et fond teal. Désigné (Champion initial, ou vainqueur contre la règle) : hachuré, en pointillés. Titre conservé : case neutre. Toujours écrit en toutes lettres, avec une légende.
  - **Atelier** : le motif d'un Positionnement archivé par une Battle est « battu par … le … », « archivé après une égalité avec … le … » ou « archivé faute de données contre … le … ».
  - « Battu » n'est jamais un titre à l'écran.
- **Glossaire** : *Title kept* (Historique des Champions) et *beaten* (Positionnement) ajoutés aux lignes `_EN_`.
- **Spec stack** : module `battles` complété (§5.2).
- **Tests** :
  - domaine : `verdict.test.ts` ;
  - API : `close-battle.test.ts`, `security.test.ts` (deux routes) ; la fabrique `closeBattle` passe désormais par l'endpoint ;
  - SPA : `close-battle.test.tsx` (ligne, désignation, égalité et abandon, Historique et Enseignement, panneau sans Battle, mobile, axe clair et sombre), et le motif dans `positionings-screen.test.tsx`.
- **Revue** (standards et spec) :
  - corrigé :
    - verrou de la Battle au règlement d'un Essai ;
    - titre défendu prouvé ou désigné dans l'Historique ;
    - motif neutre après une égalité ;
    - code mort ;
    - helpers du domaine réutilisés dans `views` ;
    - glossaire ;
  - laissé :
    - helpers de test en double entre fichiers de test ;
    - `battle-panel.tsx` exporte plusieurs pièces partagées (`tabClass` existe aussi dans la fiche Contact).
- **À trancher** :
  - un titre défendu prouvé par les données s'affiche « prouvé » (fond teal), alors que le prototype le montrait neutre ;
  - le refus `designation_required` (les données ont changé entre-temps) affiche le message générique « vérifie le Verdict ».

