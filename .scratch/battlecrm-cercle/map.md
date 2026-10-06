# Carte : BattleCRM — Cercle d'alliés

Label: wayfinder:map

## Destination

Les États du Contact refondus autour du parcours **Vivier → En prospection → Allié** (plus Archivé), consignés dans `CONTEXT.md` et un ADR 0007, puis reportés dans la [spec UX](../battlecrm-ux/spec.md) (écrans, gestes, microcopie, exigences `ST-xx`), assez pour que le ticket « Données » de la [carte stack](../battlecrm-stack/map.md) reparte sur un modèle à jour.

## Notes

- Objectif premier de Romain (2026-10-06) : rester « top of mind » auprès d'une dizaine d'ingénieurs d'affaires d'ESN très qualifiés, relancés environ toutes les 4 semaines, **même en mission**, pour qu'ils lui fassent remonter des missions (pour lui, ou plus tard en apport d'affaires).
- Amende la carte [BattleCRM](../battlecrm/map.md), en particulier [Sortie du Funnel et état d'un Contact](../battlecrm/issues/05-sortie-du-funnel-etat-contact.md), et la [spec UX](../battlecrm-ux/spec.md). Rien n'est encore construit : aucune donnée à migrer.
- Skills : `grilling` + `domain-modeling` par défaut, `prototype` pour les tickets de ce type. Vocabulaire strict de `CONTEXT.md`.
- **Exécution dans la carte** : contrairement aux autres cartes, la destination inclut d'écrire l'amendement (glossaire, ADR, spec UX), pas seulement de le décider.
- Acquis du cadrage (grilling du 2026-10-06), à appliquer par les tickets :
  - **État** (on garde le mot, EN *Status*) : **Vivier · En prospection · Allié · Archivé** (EN *Pool · Prospecting · Ally · Archived*). Le groupe des Alliés est le **Cercle d'alliés** (EN *Circle of allies*). Remplace actif / en pause / clos / gagné : **en pause et gagné disparaissent**, clos est remplacé par Vivier (silence) ou Archivé (hors sujet).
  - **Rien n'est définitif** : tout État peut revenir à tout autre. Archivé = sorti, caché par défaut, réactivable (même sens qu'une Étape ou un Positionnement archivé).
  - **Nouveau Contact au Vivier** par défaut ; l'ajout rapide permet « En prospection » (à l'Étape choisie, compte comme une entrée) ou « Allié » (réseau existant) ; `Ctrl Entrée` le fait passer En prospection.
  - **Vivier n'est plus une Étape** : Étapes types Approche → Qualif ESN → Qualif Client → Closing. Le Vivier n'est pas dans le kanban.
  - Seul un Contact **En prospection** change d'Étape, a une Relance de Cadence, un Tirage ou un Essai en cours. Quitter En prospection oblige à régler l'Essai (choix proposé : Succès vers Allié, Sans suite vers Vivier, rien vers Archivé) et annule la Relance planifiée.
  - Après un Essai sans suite : proposer **Remettre au Vivier** (silence) ; un « no go » se range en **Archivé**.
  - **Entrer au Cercle** : geste manuel « Ajouter au Cercle… », depuis tout État ; proposé après un Essai réussi à la dernière Étape. L'Allié garde sa dernière Étape atteinte.
  - **Un Allié reste Allié** quand il propose une mission : elle se suit par des Interactions (entrantes, notées). Un futur objet **Opportunité** (pour moi / apport d'affaires) ne doit pas être bloqué.
  - **Jours sans contact** d'un Allié : depuis sa dernière Interaction faite, sortante ou entrante. Un réglage, le **Rythme des Alliés** (28 j) : neutre avant 21 j, ambre clair « bientôt » de 21 à 28 j, ambre « à relancer » au-delà. Pas de Relance automatique ; une Relance planifiée facultative, si elle existe, prime sur le rythme. Les Alliés à relancer comptent dans « Aujourd'hui ».
  - Geste **« Prendre des nouvelles… »** sur un Allié : Interaction sortante, **Action de prospection** (compte dans l'Activité). Aucun A/B testing ni Battle pour les Alliés.
  - Vivier et Archivé : aucune Relance.
  - Compteurs : **Taille visée du Cercle** (10 par défaut, désactivable, « Cercle 7/10 », sans conséquence) et **Objectif d'entrées** hebdomadaire dans le Funnel (passages Vivier → En prospection, réentrées comprises ; 5 par exemple, réglable, désactivable, sans célébration — seule l'Activité en a une).
  - Écrans : page **Cercle** dans le groupe Prospection de la navigation (sous « Plus » sur mobile) : compteur, Alliés triés par jours sans contact avec leur couleur, « Prendre des nouvelles… ». « Aujourd'hui » gagne « Alliés à relancer » et « Entrées cette semaine n/5 » avec 3 ou 4 contacts du Vivier tirés au hasard et « Faire entrer ». L'écran Contacts a les puces Vivier, En prospection, Alliés, Archivés.
  - Le Cercle est ouvert à toutes les Cibles.
  - Indicateurs : en tête, Entrées dans le Funnel (semaine, face à l'objectif) et Taille du Cercle ; dans la section Funnel, les sorties par État (vers Allié, Vivier, Archivé) par Étape. Taux de passage inchangé.

## Decisions so far

<!-- une ligne par ticket résolu -->

- [Amender le glossaire et rédiger l'ADR 0007](issues/01-amender-glossaire-adr.md) : `CONTEXT.md` amendé (États, Vivier, Allié, Cercle, Entrée dans le Funnel, Rythme des Alliés, Prise de nouvelles…) et ADR 0007 ; « bientôt » = 7 derniers jours du Rythme, un Allié remis En prospection garde sa Relance.

## Pas encore spécifié

- **Nouvelles exigences pour la stack** (`ST-xx`) : jours sans contact calculés dans le fuseau de l'Utilisateur, objectif hebdomadaire en valeurs en vigueur (ADR 0003), compteurs de Cercle ; à préciser quand les gestes et l'objectif d'entrées seront tranchés.

## Hors périmètre

- **Opportunité** (mission remontée par un Allié, pour moi ou en apport d'affaires, avec son issue) : fonctionnalité future ; cette carte garantit seulement que rien ne la bloque.
- A/B testing des prises de nouvelles auprès des Alliés : trop peu de contacts et pas de critère de succès.
- Pause globale de la prospection pendant une mission : sans objet depuis la suppression d'« en pause ».
