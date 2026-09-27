# Règle de victoire et clôture d'une Battle

Type: grilling
Status: resolved
Blocked by: 01, 02, 03

## Question

À partir des conclusions de la recherche statistique, quelle règle précise clôt une Battle, et qui la déclenche ?

À trancher :
- Seuil retenu (par ex. P(A > B) ≥ 0,85 ?) et nombre minimum d'Essais terminés.
- Clôture automatique ou proposition que l'Utilisateur confirme ?
- Que devient une Battle sans vainqueur (égalité, trop peu de succès) : plafond d'Essais, abandon, prolongation ?
- Comment présenter l'état « pas encore concluant » pour rester motivant (lien avec le cadrage des échecs).
- Décision probablement digne d'un ADR (difficile à changer, surprenante, vrai compromis).

## Comments

- Cycle de vie de l'Essai (2026-09-26) : reste à trancher ici le sort des Essais **encore en cours** à la clôture d'une Battle (leur issue est figée à la clôture). Voir [Cycle de vie d'un Essai et définition de son succès](02-cycle-de-vie-essai.md).
- Cycle de vie d'une Battle (2026-09-26) : il y a toujours un Champion (un Champion initial est désigné avant la première Battle d'une Étape), donc « égalité → le Champion garde son titre » vaut partout. Une Battle a exactement 2 Positionnements ; le verdict porte sur toutes les Cibles réunies. Voir [Cycle de vie d'une Battle : ouverture, participants, répartition](03-cycle-de-vie-battle.md).

- Cadrage des échecs dans le modèle (2026-09-27) : **amende le vocabulaire** de cette réponse, pas son fond : « échec » (issue d'un Essai) → **sans suite**, État « perdu » → **clos**, Positionnement « perdant » → **battu**. Voir [Cadrage des échecs dans le modèle](09-cadrage-des-echecs.md).

## Answer

Tranché en grilling avec Romain (2026-09-26). ADR : [Règle de victoire bayésienne, avec garde-fous mais sans verrou](../../../docs/adr/0001-regle-de-victoire-bayesienne-sans-verrou.md). Termes intégrés à `CONTEXT.md` (nouveaux : **Règle de victoire**, **Horizon**, **Verdict** ; précisés : Battle, Historique des Champions, Positionnement, Essai).

- **Règle** : la Battle est concluante quand P(Challenger > Champion) ≥ seuil, ou ≤ 1 − seuil (victoire symétrique : le Champion peut « défendre son titre » avant l'Horizon), une fois atteint un **minimum** de 10 Essais terminés par Positionnement et de 5 succès au total.
- **Réglages** : seuil (0,85 par défaut) et Horizon (25 par défaut) sont réglables à l'ouverture, pré-remplis depuis la Battle précédente de l'Étape, puis **figés**. Le minimum est fixé dans l'app et n'est pas réglable.
- **Horizon** : il compte les Essais **commencés** (hors annulés) par Positionnement. Une fois atteint, l'app ne propose plus ce Positionnement ; le verdict d'Horizon tombe quand ses Essais en cours sont réglés. Un Essai annulé libère une place.
- **Déclenchement** : l'app signale que la Battle est concluante et arrête de proposer de nouveaux Essais ; l'Utilisateur **confirme** la clôture (il peut encore corriger des issues d'ici là).
- **Pas de verrou** : à tout moment, l'Utilisateur peut déclarer A ou B vainqueur sans que la règle soit satisfaite, et même contre les données. Il doit seulement confirmer un avertissement (« pas assez de données » ou « les données indiquent l'inverse »). Le Verdict est alors marqué **« désigné par l'Utilisateur »**, avec les comptes au moment de la décision, dans la Battle et dans l'Historique des Champions.
- **Essais en cours à la clôture** : ils passent automatiquement en **annulé**, motif « Battle clôturée » (non comptés). Une réponse arrivée plus tard devient une simple Interaction.
- **Verdicts** (liste fermée) : victoire du Challenger (il devient Champion) ; titre défendu ; égalité (Horizon atteint sans verdict) ; données insuffisantes (Horizon atteint avec moins de 3 succès au total) ; abandonnée (clôture manuelle : la Battle n'a rien appris, par exemple si le Critère de succès était mal choisi). Sauf victoire du Challenger, le Champion garde son titre. Le Challenger perdant est archivé, **sauf en cas d'abandon** : il n'a pas vraiment été testé et reste disponible.
- **Pas d'arrêt anticipé pour égalité** sur la perte attendue : trop rare à ces volumes.
- **« Pas encore concluant »** : aucun état de Battle en plus de « ouverte » et « concluante ». Le modèle garantit seulement de quoi afficher la progression vers le minimum et l'Horizon, P(Challenger > Champion) avec les comptes bruts, et la mention « seul un écart important est détectable à ce volume ». La présentation relève de la spec UX et du cadrage des échecs.
