# Amender le glossaire et rédiger l'ADR 0007

Type: task
Status: resolved
Blocked by: 

## Question

Reporter les acquis du cadrage (voir les Notes de la [carte](../map.md)) dans `CONTEXT.md` et dans un ADR 0007 (« Les États Vivier, En prospection, Allié et Archivé remplacent actif, en pause, clos et gagné »), puis faire relire le tout par Romain.

À couvrir dans `CONTEXT.md` :
- Réécrire **État** et ses valeurs `_EN_` ; nouveaux termes **Vivier**, **Allié**, **Cercle d'alliés**, **Rythme des Alliés**, **Jours sans contact**, **Taille visée du Cercle**, **Objectif d'entrées**, **Entrée dans le Funnel** (ou précision de l'existante).
- Repasser chaque mention de « actif », « en pause », « clos », « gagné » : Contact (entrée au Vivier par défaut), Étape (archivage : « Contacts actifs ou en pause »), Interaction, Relance, Tirage, Essai, À traiter, En attente, Sans prochaine action, Action de prospection (« Prendre des nouvelles »), Funnel (première Étape d'entrée), Taux de passage.
- Vérifier la cohérence avec les ADR 0002 (Tirage qui tombe quand le Contact quitte l'État actif) et 0006 (anonymisation).

L'ADR 0007 note aussi qu'un Allié reste Allié pendant une mission, pour ne pas fermer la porte à une future Opportunité.

## Answer

Rédigé puis relu et validé par Romain (2026-10-06).

- **`CONTEXT.md`** : État réécrit (Vivier, En prospection, Allié, Archivé ; seul En prospection est dans le Funnel ; tout État revient à tout autre). Nouveaux termes : Vivier, En prospection, Allié, Cercle d'alliés, Archivé, Entrée dans le Funnel, Objectif d'entrées, et une section « Cercle d'alliés » (Jours sans contact, Rythme des Alliés, Prise de nouvelles, Taille visée du Cercle). Toutes les mentions d'actif, en pause, clos et gagné sont repassées.
- **[ADR 0007](../../../docs/adr/0007-etats-vivier-en-prospection-allie-archive.md)** : décision, options écartées (garder gagné, Étape « Allié », garder en pause), conséquences. Les ADR 0002 et 0006 restent intacts : l'ADR 0007 indique qu'« actif » s'y lit En prospection et « clore » archiver.

Précisions ajoutées au cadrage et validées :
- Signal « bientôt » : les 7 derniers jours du Rythme des Alliés, quel que soit le Rythme.
- **Prise de nouvelles** : nom de l'Interaction sortante créée par « Prendre des nouvelles… » ; c'est une Action de prospection.
- Anglais : Pool, Prospecting, Ally, Archived, Circle of allies, Funnel entry, Entry goal, Check-in rhythm, Check-in, Days since contact, Circle size goal ; signaux *Check in soon* et *Time to check in*.
- Relance : passer au Vivier ou en Archivé l'annule, quitter En prospection aussi ; un Allié remis En prospection garde la sienne.
- Retour En prospection : à la dernière Étape atteinte, ou à une Étape choisie si elle est archivée ou s'il n'en a jamais atteint.
- Entrée dans le Funnel : depuis le Vivier (réentrées comprises) ou dès l'ajout. Le cas d'un Allié ou d'un Archivé remis En prospection reste au ticket « Objectif d'entrées hebdomadaire ».
- Jours sans contact d'un Allié sans aucune Interaction faite : comptés depuis son entrée au Cercle.
