# 37: Aujourd'hui : ce qui est à traiter

**What to build:** l'écran Aujourd'hui sur bureau montre, dans une seule liste triée par ancienneté du retard, les Relances du jour ou en retard et les Alliés à relancer, puis les Essais délai dépassé, avec leurs actions directes ; la navigation porte la pastille ambre « 3 à traiter, 2 Alliés à relancer ». Le bandeau Entrées et les tirages du jour arrivent au ticket 38, l'Activité au ticket 39. Sources : spec UX §5.1, §3.1 (pastilles) ; prototypes `prototype/01-aujourdhui` (B) et `prototype/03-page-cercle` (C) ; ST-46.

**Blocked by:** 29, 36

**Status:** resolved

- [x] Calculé localement depuis le résumé par `contactAgenda` et `allySignal`, avec le fuseau en vigueur ; ligne d'un Allié marquée « Allié », « Rythme dépassé (n j) · n j sans contact »
- [x] Actions directes : Relance (Relancer…, Reporter, Annuler, A répondu…) ; Essai délai dépassé (Sans suite, Relancer quand même) ; Allié (Prendre des nouvelles…) ; lien vers la fiche en panneau
- [x] Colonne latérale : « Cercle 7/10 » avec lien, « À venir » (Relances de demain)
- [x] Pastille ambre sur Aujourd'hui (nombre seul ; infobulle et libellé accessible « 3 à traiter, 2 Alliés à relancer ») ; aucune pastille sur Cercle
- [x] États vides : premier jour (« Aucun Contact pour l'instant », les Étapes types, « Ajouter un Contact » `N`) ; rien de prévu
- [x] Écran d'arrivée après la connexion ; axe sans erreur dans les deux thèmes

## Comments

**2026-10-24, implémentation (agent).**
- **Calcul** (`apps/web/src/today/to-handle.ts`, `toHandleOf`) : depuis le résumé, `contactAgenda` (via `agendaOf`) pour les Contacts En prospection et `allySignal` (via `allySignalOf`) pour les Alliés, au jour du fuseau en vigueur (`todayOf`). Une seule liste « Relances et Alliés à relancer », triée par jours de retard (depuis le jour de la Relance, ou la fin du Rythme pour un Allié), la plus ancienne d'abord, Relances du jour comprises (0 j), puis par nom ; un Allié dont la Relance est due y figure comme une Relance. Puis les Essais délai dépassé, la fin du délai la plus ancienne d'abord. Les Relances de demain et les deux compteurs de la pastille viennent du même calcul.
- **Écran** (`apps/web/src/today/today-screen.tsx`, route `/today` avec les mêmes paramètres de geste que le Cercle, ST-70) : ligne cliquable comme celles du Cercle (nom étiré sur la ligne, fiche en panneau, en page sur mobile ; focus rendu à la ligne à la fermeture du panneau). Ligne d'un Allié marquée « Allié » (★ et texte), « Rythme dépassé (n j) · n j sans contact », **Prendre des nouvelles…** ; Relance : `CardActions` du Funnel (Relancer…, Reporter, Annuler, A répondu…) ; Essai délai dépassé : Sans suite, Relancer quand même. Colonne latérale : « Cercle 7/10 → » (ou « Cercle · 7 Alliés » sans Taille visée), lien vers `/circle` ; « À venir » avec les Relances de demain. États vides : premier jour (« Aucun Contact pour l'instant. », les Étapes du Funnel, « Ajouter un Contact » `N`) et « Rien à traiter aujourd'hui. ». La fiche ouverte prend la place de la colonne latérale.
- **Pastille** (`today/today-count.ts`, `shell/nav-link.tsx`) : compteur ambre (texte et contour, sans fond) sur Aujourd'hui, dans la barre latérale et dans la barre d'onglets du mobile ; nombre seul, infobulle et libellé accessible « 3 à traiter, 2 Alliés à relancer » (chaque partie seulement si non nulle) ; aucune à zéro, aucune sur Cercle. « à traiter » ne compte que les Contacts En prospection (Relances dues et Essais délai dépassé) ; les Alliés comptent leur Relance due.
- **Écran d'arrivée** : `/today` l'était déjà (`LANDING`), couvert par `auth/sign-in.test.tsx`.
- `ROW_LINK_CLASS` partagé entre le Cercle et Aujourd'hui (`screens/row-link.ts`).
- **Tests** : `today/today-screen.test.tsx` (12 cas : ordre et textes, pastille, colonne latérale, gestes et panneau, états vides, Reporter avec « Annuler », axe dans les deux thèmes). Pas de migration.
- **Laissé aux tickets suivants** : bandeau Entrées, Contacts sans prochaine action et Battles concluantes (38), Activité (39), une carte à la fois sur mobile (40).
- **À trancher** : un Allié est « à relancer » dès le dernier jour du Rythme (`allySignal`, ticket 36), donc ce jour-là la ligne dit « Rythme dépassé (0 j) ». Le prototype C03 ne le montrait qu'au-delà du Rythme.
