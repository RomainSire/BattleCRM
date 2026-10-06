# Objectif d'entrées hebdomadaire : semaine, comptage et modification

Type: grilling
Status: resolved
Blocked by: 

## Question

Comment se compte et se règle l'Objectif d'entrées dans le Funnel, qui est le premier objectif **hebdomadaire** du modèle (l'Objectif d'activité est journalier) ?

À trancher :
- Début de semaine (lundi ?) et fuseau : même logique que l'Activité (fuseau en vigueur ce jour-là) ?
- Une modification s'applique-t-elle dès la semaine suivante, avec la valeur en vigueur conservée pour les semaines passées (ADR 0003) ?
- Une entrée annulée (« Annuler » juste après coup) ou un aller-retour Vivier → En prospection → Vivier → En prospection dans la même semaine : combien d'entrées ?
- Un Contact ajouté directement En prospection, ou un Allié remis En prospection : est-ce une entrée ?
- Valeur par défaut, et ce que montre la semaine en cours quand l'objectif est atteint (sans célébration).

## Answer

Tranché avec Romain (grilling du 2026-10-06). `CONTEXT.md` (Entrée dans le Funnel, Objectif d'entrées) et l'ADR 0003 sont amendés en conséquence.

- **Semaine** : du lundi au dimanche, fixe, sans réglage. Chaque Entrée est rattachée au jour de son enregistrement, dans le fuseau de l'Utilisateur en vigueur ce jour-là (même logique que l'Activité) ; la semaine est la somme de ses jours.
- **Modification** : effet à partir du lundi suivant ; la semaine en cours garde sa valeur. La valeur en vigueur de chaque semaine est conservée (ADR 0003, amendé). Les Réglages l'indiquent (« s'applique à partir du lundi 12 oct. »).
- **Ce qui compte** : toute arrivée En prospection depuis un autre État (Vivier, Allié, Archivé) ou dès l'ajout. La définition d'Entrée dans le Funnel, qui disait « depuis le Vivier », est alignée sur celle d'État.
- **Annulation et allers-retours** : un geste annulé (« Annuler ») ne laisse aucune Entrée ; un aller-retour réel compte autant d'Entrées que de passages (pas de dédoublonnage par Contact ou par semaine).
- **Date** : un changement d'État est daté de sa saisie, il ne s'antidate pas. Une Interaction sortante antidatée qui l'accompagne compte dans l'Activité à sa propre date.
- **Valeur par défaut** : 5 (une par jour ouvré), activé.
- **Objectif atteint ou dépassé** : on peut le dépasser sans friction. Le bloc « Entrées cette semaine » d'« Aujourd'hui » garde ses propositions du Vivier. Il affiche « 6/5 », en couleur de succès dès que l'objectif est atteint, sans célébration.
- **Désactivé** : les Entrées restent comptées et affichées sans dénominateur ni couleur (« 3 cette semaine »), avec les propositions du Vivier. La désactivation et la réactivation sont des modifications comme les autres (effet au lundi suivant ; « aucun objectif » est conservé comme valeur en vigueur).
- **Indicateurs, semaines passées** : comme l'Activité, ni ligne d'objectif ni couleur de succès sur l'historique. Au survol : « 6 entrées · objectif : 5 », avec la valeur en vigueur cette semaine-là. La couleur de succès est réservée à la semaine en cours (en tête des Indicateurs et dans « Aujourd'hui »).

À reporter dans la spec UX par le ticket « Reporter la refonte des États dans la spec UX » ; le rendu exact du bloc relève du ticket « Page Cercle et blocs Cercle d'« Aujourd'hui » ».
