# Carte : BattleCRM

Label: wayfinder:map

## Destination

Le **modèle de domaine** de BattleCRM (Funnel, Positionnement, Battle, Essai, Contact, Interaction) et la **méthode statistique** qui désigne le vainqueur d'une Battle avec 20 à 50 Contacts sont verrouillés et consignés (`CONTEXT.md` + ADR), assez pour qu'une future spec d'UX et de stack s'appuie dessus sans rien avoir à retrancher.

## Notes

- Domaine : CRM de prospection pour développeurs freelance (clients finaux **et** ESN), fondé sur l'A/B testing de Positionnements.
- Skills à consulter à chaque session : `grilling` + `domain-modeling`. Glossaire : `CONTEXT.md` (en utiliser strictement le vocabulaire).
- Contraintes permanentes fixées au cadrage (2026-09-26) :
  - **Multi-utilisateur dès le départ** : hébergé sur le VPS de Romain, accessible depuis PC et mobile, donc auth obligatoire. L'ouverture des inscriptions est pilotée par une variable d'environnement (pas de dashboard admin).
  - **Un seul Funnel par Utilisateur**, configurable ; un Contact peut sauter des Étapes.
  - Un Positionnement appartient à exactement une Étape.
  - Vainqueur de Battle : quand les données montrent, avec assez de confiance, que A réussit mieux que B (idée de départ : « 85 % », sens exact à préciser), le vainqueur devient Champion et affronte un Challenger.
  - Succès d'un **Essai** : piste de Romain = validation **manuelle** (bouton « positionnement validé ») plutôt que le seul passage d'Étape ; si le Contact change d'Étape pendant un Essai en cours, une popup demande succès ou échec.
  - Exigences produit à garder en tête pour la spec suivante : plus ergonomique qu'Excel/Notion/Airtable, rapide au quotidien, et **aider à se détacher des réponses négatives** (un échec = un point de donnée).
- Il existe une V1 construite avec une autre méthode ; ce projet est une réécriture pour comparer les deux approches. Pas de reprise de données prévue.
- Tour de grilling « en largeur » du cadrage **terminé** (2026-09-26). Acquis intégrés à `CONTEXT.md` (Organisation, Relance, Historique des Champions, précisions sur Contact, Positionnement et Interaction) et en commentaires des tickets concernés.
- Pas de contrainte RGPD pour l'instant (Romain seul Utilisateur), mais ne rien fermer qui empêcherait une ouverture au public (suppression d'un Contact, anonymisation).

## Decisions so far

<!-- une ligne par ticket résolu -->

- [Méthode statistique pour désigner le vainqueur d'une Battle sur un petit échantillon](issues/01-methode-statistique-petits-echantillons.md) : bayésien bêta-binomial, « 85 % » = P(Challenger > Champion) ≥ 0,85 avec minimum d'Essais et de succès ; égalité → le Champion garde son titre ; l'app propose le Positionnement par tirage équilibré (seuils définitifs à fixer par la règle de victoire).
- [Cycle de vie d'un Essai et définition de son succès](issues/02-cycle-de-vie-essai.md) : l'Essai naît à l'usage confirmé ; issues en cours / succès / échec / annulé ; critère de succès figé par Battle ; délai de réponse = signal, l'échec est toujours confirmé à la main ; issue figée à la clôture.
- [Cycle de vie d'une Battle : ouverture, participants, répartition](issues/03-cycle-de-vie-battle.md) : une Battle ouverte au plus par Étape, toujours Champion contre un Challenger (Champion initial désigné pour la première) ; ouverture explicite ; tirage équilibré stratifié par Cible, verdict global ; Positionnement figé dès son premier Essai, battu archivé et réactivable ; Contact déjà exposé signalé, jamais bloqué.
- [Règle de victoire et clôture d'une Battle](issues/04-regle-de-victoire.md) : P ≥ 0,85 (symétrique) après ≥ 10 Essais terminés par Positionnement et ≥ 5 succès ; seuil et Horizon (25 Essais commencés) figés à l'ouverture ; l'app signale, l'Utilisateur clôt et peut forcer un vainqueur (marqué « désigné ») ; Essais en cours annulés à la clôture ; Verdicts : victoire, titre défendu, égalité, données insuffisantes, abandonnée. ADR 0001.
- [Sortie du Funnel et état d'un Contact](issues/05-sortie-du-funnel-etat-contact.md) : États actif / en pause / clos (ex-« perdu ») / gagné, distincts de l'Étape (clos et gagné gardent la dernière Étape atteinte) ; un Essai en cours implique un Contact actif, donc quitter l'État actif oblige à régler l'Essai ; réactivation libre à l'Étape actuelle ; changements d'État tracés en Interactions ; Relances conservées en pause, annulation proposée pour clos ou gagné.
- [Interactions, Relances et rattachement aux Essais](issues/06-interactions-relances-essais.md) : Interaction rattachée au Contact, avec un sens (sortante / entrante) ; l'utilisation d'un Positionnement est une Interaction qui fait commencer l'Essai ; Relance = Interaction planifiée, puis faite ou annulée, signalée « en retard » ; nouvelle Cadence de relance (+3, +7, +14 depuis la dernière Interaction faite, puis Délai de réponse), **portée par le Positionnement** et donc testable en Battle ; écart par Contact tracé sur l'Essai.
- [Attribution quand plusieurs Battles touchent un même Contact](issues/07-attribution-plusieurs-battles.md) : limite assumée, aucune règle ; le tirage aléatoire neutralise l'influence amont entre les deux bras ; pas de champ amont sur l'Essai (reconstituable par les Interactions), pas de stratification ni de signal si le Champion amont change ; une Battle compare les Positionnements parmi les Contacts qui atteignent son Étape.
- [Évolution du Funnel en cours de route](issues/08-evolution-du-funnel.md) : l'Étape a une identité indépendante de son nom ; réordonner ne déplace personne et ne réécrit pas l'historique (sens avant / arrière lu dans l'ordre du moment) ; une Étape qui a servi est archivée (pas de Battle ouverte ni de Contact actif ou en pause), restaurable telle quelle ; ajout sans effet rétroactif ; toujours au moins une Étape non archivée.
- [Cadrage des échecs dans le modèle](issues/09-cadrage-des-echecs.md) : vocabulaire neutre (issue **sans suite**, État **clos**, Positionnement **battu**) ; **Enseignement** optionnel sur chaque Battle close ; l'effort est valorisé plutôt que le taux de succès : **Activité** (Actions de prospection par jour) et **Objectif d'activité** journalier (1 par défaut), célébré s'il est atteint, jamais sanctionné.

## Pas encore spécifié

<!-- vide : les trois zones de brouillard ont été converties en tickets le 2026-09-26 -->

## Hors périmètre

- UX, écrans et parcours détaillés : pour la spec qui suivra cette carte.
- Stack technique, déploiement sur le VPS, implémentation de l'auth.
- Écrans d'indicateurs de Funnel (taux de passage entre Étapes, volume de Contacts par semaine) et d'Activité (graphe journalier façon GitHub, totaux hebdomadaires, célébration de l'Objectif atteint) : souhaités, mais relèvent de la spec suivante ; le modèle garantit seulement l'historique daté des changements d'Étape et des Actions de prospection qui les rend calculables.
- Import de Contacts et extension Firefox d'ajout en un clic depuis un profil LinkedIn : fonctionnalités futures ; le modèle prévoit seulement l'URL LinkedIn optionnelle du Contact.
- Partage de données entre Utilisateurs : isolation stricte.
- Garde-fou « une seule variable testée à la fois » : responsabilité de l'Utilisateur, pas une contrainte du modèle.
