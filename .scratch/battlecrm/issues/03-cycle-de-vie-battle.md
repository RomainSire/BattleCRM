# Cycle de vie d'une Battle : ouverture, participants, répartition

Type: grilling
Status: resolved
Blocked by:

## Question

Comment une Battle naît-elle, qui y participe et comment les Contacts y sont-ils répartis ?

À trancher :
- Une seule Battle active par Étape ? Peut-on avoir des Battles actives sur plusieurs Étapes en même temps ?
- Toujours exactement 2 Positionnements (Champion vs Challenger), ou A/B/C possible ?
- Première Battle d'une Étape (pas encore de Champion) : deux Challengers ?
- Qui choisit le Positionnement pour un Contact donné : l'appli (suggestion, alternance, tirage) ou l'Utilisateur ? Peut-on forcer ?
- Segmentation : un Contact ESN et un Contact client final comptent-ils dans la même Battle, ou la cible (ESN / client final) est-elle un attribut qui peut séparer les résultats ?
- Un Positionnement perdant est-il archivé ? Réutilisable plus tard ? Peut-on modifier un Positionnement en cours de Battle (non, a priori → nouvelle version) ?

## Comments

- Cadrage (2026-09-26) : la cible (ESN / client final) est portée par l'**Organisation** du Contact (inconnue si aucune Organisation) : c'est elle qui permettrait de séparer les résultats.
- Cadrage (2026-09-26) : un Positionnement a un libellé, une description et des PJ optionnelles, et fixe le canal (deux canaux = deux Positionnements). Reste à trancher ici : figé / versionné une fois en Battle.
- Recherche statistique (2026-09-26) : recommande que l'app **propose** le Positionnement par tirage aléatoire équilibré (blocs de 2), dérogation manuelle tracée ; pas de Thompson sampling. Voir [Méthode statistique pour désigner le vainqueur d'une Battle sur un petit échantillon](01-methode-statistique-petits-echantillons.md), §7 de la recherche.

- Cadrage des échecs dans le modèle (2026-09-27) : **amende le vocabulaire** de cette réponse, pas son fond : « échec » (issue d'un Essai) → **sans suite**, État « perdu » → **clos**, Positionnement « perdant » → **battu**. Voir [Cadrage des échecs dans le modèle](09-cadrage-des-echecs.md).

## Answer

Tranché en grilling avec Romain (2026-09-26). Termes intégrés à `CONTEXT.md` (Battle, Champion, Positionnement, Essai, Contact, nouveau terme **Cible**).

- **Simultanéité** : au plus une Battle ouverte par Étape ; plusieurs Étapes peuvent avoir chacune la leur en même temps (le biais d'attribution entre Étapes reste dans le « pas encore spécifié » de la carte).
- **Participants** : toujours exactement 2 Positionnements, le Champion contre un Challenger. Pas d'A/B/C (un troisième bras ferait passer chaque Positionnement sous le minimum de 10 Essais terminés).
- **Première Battle d'une Étape** : l'Utilisateur désigne un **Champion initial** (en général ce qu'il utilise déjà), marqué « désigné » et non « gagné » dans l'Historique des Champions. La règle « égalité → le Champion garde son titre » s'applique ainsi sans exception.
- **Ouverture** : explicite, par l'Utilisateur qui choisit le Challenger ; critère de succès et délai de réponse pré-remplis depuis la Battle précédente de l'Étape. Entre deux Battles, on utilise le Champion sans créer d'Essai.
- **Répartition** : l'app propose le Positionnement par tirage aléatoire équilibré (blocs de 2), **stratifié par Cible** ; une dérogation de l'Utilisateur est possible et tracée.
- **Cible** (ESN / client final / inconnue) : figée sur l'Essai au moment où il commence. Les Cibles sont mélangées dans une même Battle, les résultats peuvent être ventilés par Cible à titre indicatif, mais le verdict porte sur l'ensemble. Une Battle peut en option être restreinte à une seule Cible.
- **Positionnement figé** dès son premier Essai (seule une faute de frappe dans le libellé reste corrigible). Toute autre modification crée un nouveau Positionnement, avec un lien optionnel « dérivé de ». Pas de notion de version.
- **Perdant** : archivé (plus proposé, toujours consultable), réactivable plus tard comme Challenger ; ses compteurs repartent de zéro, et les Essais de deux Battles ne sont jamais cumulés.
- **Contact déjà exposé** : aucun verrou. Un Contact peut participer à toute nouvelle Battle d'une Étape (retour en arrière, reprospection) ; seuls deux Essais dans la même Battle restent interdits. L'app **signale** une exposition antérieure (« déjà exposé à CV A le 12/03, échec ») sans orienter le tirage.
