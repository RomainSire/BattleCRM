# Écran « Aujourd'hui »

Type: prototype
Status: resolved
Blocked by: 

## Question

À quoi ressemble l'écran d'accueil, qui répond à « qu'est-ce que je fais aujourd'hui ? » ?

À trancher :
- Contenu et **ordre de priorité** des blocs : Relances dues ou en retard, Essais « délai dépassé », Battles concluantes à clôturer, Activité du jour face à l'Objectif d'activité, autres ?
- Ce qu'on peut **faire directement** depuis l'écran, sans ouvrir la fiche Contact : marquer une Relance faite ou la reporter, confirmer un Essai sans suite, etc.
- L'écran quand il n'y a rien à faire : état vide, Objectif déjà atteint, premier jour.
- Relation avec la navigation globale (fog) : l'écran est-il aussi le point d'entrée mobile ?

## Assets

- Prototype jetable (3 variantes A/B/C, scénarios, largeur mobile) : branche `prototype/01-aujourdhui`, fichier `.scratch/battlecrm-ux/prototypes/01-aujourdhui.html` (`git show prototype/01-aujourdhui:.scratch/battlecrm-ux/prototypes/01-aujourdhui.html > /tmp/p.html`).

## Answer

Tranché avec Romain le 2026-09-29, sur le prototype.

**Forme.** Sur bureau : un **tableau de bord par blocs** (variante B). La colonne principale contient les Relances, séparées entre « en retard » et « aujourd'hui », puis les Essais « délai dépassé », puis les Contacts sans prochaine action. La colonne latérale contient l'Activité du jour face à l'Objectif (jauge et graphe des 4 dernières semaines), les Battles concluantes et « À venir » (Relances de demain). Sur mobile : **une chose à la fois** (variante C). Une carte par élément, dans l'ordre de priorité, avec la progression de la journée et un écran « journée bouclée » à la fin. « Aujourd'hui » est l'écran d'arrivée sur les deux supports.

**Ordre de priorité** (ordre de la file mobile, et ordre des blocs sur bureau) : les Relances en retard, la plus ancienne en premier, puis les Relances du jour, les Essais « délai dépassé » et les Battles concluantes.

**Bloc « Contacts sans prochaine action ».** Il regroupe les Contacts actifs sans Relance planifiée ni Essai en cours, sinon ils sortent du radar. Il faut en limiter le nombre : piste retenue, 3 ou 4 Contacts tirés au hasard, pas toute la liste. L'action principale est « Utiliser un Positionnement », qui renvoie au geste central ; l'action secondaire est « Planifier une Relance ».

**Actions directes, sans ouvrir la fiche Contact :**
- Relance : **Faite** (compte dans l'Activité et affiche la Relance suivante planifiée par la Cadence), **Reporter** (demain, +3 j, +7 j), **Annuler**, **A répondu…**. Ce dernier bouton est nouveau : quand le Contact a répondu, la Relance n'a plus lieu d'être. Son déroulé est à trancher dans le ticket « Enregistrer une réponse du Contact ».
- Essai « délai dépassé » : **Sans suite**, qui **propose ensuite de clore le Contact** (sans l'imposer) ; ou **Relancer quand même** (écart à la Cadence, tracé sur l'Essai).
- Battle concluante : **Clôturer…**, qui mène à l'écran Battle ; ou **Plus tard**, qui la masque pour la journée.
- Partout, un lien vers la fiche Contact.

**États vides :**
- Premier jour : « Aucun Contact pour l'instant », le Funnel pré-rempli avec ses Étapes types (modifiables dans les Réglages), et le bouton « Ajouter un Contact » (raccourci `N`). Pas d'assistant.
- Rien de prévu : un message, les Relances de demain, et les Contacts sans prochaine action.
- Objectif atteint : un signal sobre sur la jauge. Son intensité est tranchée par le ticket « Détachement des réponses négatives dans l'UX ».

**Clavier (bureau).** Palette `Ctrl K`, ajout rapide `N`. Les raccourcis par élément (`F` faite, `R` reporter, `S` sans suite) sont gardés comme piste ; la navigation `J`/`K` de la variante A n'a pas été retenue telle quelle.

**Précision (ticket [Réglages](14-reglages.md))** : un Contact actif dans une Étape qui n'a aucun Positionnement (par ex. le Vivier) ne compte pas comme « sans prochaine action ». Il n'apparaît pas dans « Aujourd'hui » et se range dans « En attente », sans signal.
