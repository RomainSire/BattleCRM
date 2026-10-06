# Les États Vivier, En prospection, Allié et Archivé remplacent actif, en pause, clos et gagné

Les États actif, en pause, clos et gagné décrivaient une prospection qui se termine : on gagne (mission signée) ou on abandonne. Or l'objectif premier de l'Utilisateur n'est pas de « gagner » un Contact une fois, mais de rester présent auprès d'une dizaine d'ingénieurs d'affaires d'ESN, relancés environ toutes les quatre semaines, même pendant une mission, pour qu'ils lui fassent remonter des missions. Un Contact « gagné » sortait justement de tout suivi. Nous remplaçons donc les États par un parcours **Vivier → En prospection → Allié**, plus **Archivé** : le Vivier rassemble les Contacts qu'on pourrait prospecter (dont les silences, qui étaient « clos »), En prospection est le seul État dans le Funnel, Allié est l'aboutissement entretenu dans la durée (le **Cercle d'alliés**), Archivé range le hors sujet. Rien n'est définitif : tout État peut revenir à tout autre. Détail : `.scratch/battlecrm-cercle/map.md`.

## Considered Options

- **Garder gagné et ajouter un rappel périodique** : un « gagné » qu'on relance n'est plus gagné ; le mot disait l'inverse de l'usage.
- **Une Étape « Allié » en fin de Funnel** : l'Allié aurait été pris dans les Battles, le Tirage, la Cadence et le Taux de passage, alors qu'on ne teste rien sur une dizaine de personnes sans critère de succès.
- **Garder en pause** : il n'avait plus d'usage distinct. Un silence se range au Vivier, et une mission de l'Utilisateur ne met pas la prospection en pause, puisque c'est le moment où les Alliés comptent le plus.

## Conséquences

- Le Vivier n'est plus une Étape : il sort du Funnel et du kanban. Passer du Vivier à En prospection est une **Entrée dans le Funnel**, que l'Utilisateur suit avec un **Objectif d'entrées** hebdomadaire.
- Un Allié n'a ni Cadence, ni Tirage, ni Essai, et aucune Battle ne porte sur lui : il est suivi par ses **Jours sans contact** face au **Rythme des Alliés**, sans Relance automatique. Une **Prise de nouvelles** est une Action de prospection.
- Un Allié reste Allié quand il propose une mission : elle se suit par ses Interactions. Un futur objet **Opportunité** (mission pour l'Utilisateur ou apport d'affaires) pourra s'y rattacher sans changer d'État ; ce modèle ne doit pas le bloquer.
- Dans les ADR 0002 et 0006, « actif » se lit désormais En prospection et « clore » se lit archiver ; leurs décisions sont inchangées : le Tirage tombe quand le Contact quitte En prospection, et archiver un Contact ne répond pas plus à l'effacement que clore.
