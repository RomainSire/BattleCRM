# Sortie du Funnel et état d'un Contact

Type: grilling
Status: resolved
Blocked by: 02

## Question

Quel état porte un Contact en plus de son Étape, et quel effet a chaque état sur ses Essais en cours ?

Acquis du cadrage (2026-09-26) : l'état est **distinct de l'Étape** (« perdu » n'est pas un palier du Funnel).

À trancher :
- Liste des états : actif / gagné / perdu / en pause ? Autre chose ?
- Que signifie « gagné » : mission signée ? Est-ce aussi une Étape finale du Funnel ?
- Passer en « perdu » ou « en pause » : les Essais en cours deviennent-ils des échecs, restent-ils en cours, ou demande-t-on à l'Utilisateur (comme pour un changement d'Étape) ?
- Peut-on réactiver un Contact perdu ? Dans ce cas, redémarre-t-il à son Étape ou à la première ?
- Un Contact perdu ou en pause peut-il encore recevoir des Relances ?

## Comments

- Cycle de vie d'une Battle (2026-09-26) : aucun verrou n'empêche un Contact « perdu » ou archivé d'être reprospecté plus tard et de participer à une nouvelle Battle (signalé, pas bloqué). À prendre en compte pour la réactivation d'un Contact. Voir [Cycle de vie d'une Battle : ouverture, participants, répartition](03-cycle-de-vie-battle.md).

- Cadrage des échecs dans le modèle (2026-09-27) : **amende le vocabulaire** de cette réponse, pas son fond : « échec » (issue d'un Essai) → **sans suite**, État « perdu » → **clos**, Positionnement « perdant » → **battu**. Voir [Cadrage des échecs dans le modèle](09-cadrage-des-echecs.md).

## Answer

Tranché en grilling avec Romain (2026-09-26). Nouveau terme **État** dans `CONTEXT.md` ; précisés : Contact, Essai, Interaction.

- **États** (liste fermée) : actif, en pause, perdu, gagné. Un nouveau Contact est actif. « Perdu » porte un motif libre optionnel ; un refus explicite (« ne me recontactez pas ») est un motif de perdu, pas un État de plus.
- **Gagné** : l'objectif de la prospection est atteint (mission signée, référencement obtenu en ESN, selon ce que l'Utilisateur décide). C'est un État, **pas une Étape**, tout comme perdu : le Contact garde la dernière Étape atteinte, ce qui montre où il est sorti du Funnel (et rend les indicateurs de sortie calculables). Rien n'empêche l'Utilisateur de créer une Étape « négociation » s'il le souhaite.
- **Invariant** : un Essai en cours implique un Contact actif. Quitter l'État actif ouvre une popup qui oblige à régler l'Essai en cours : choix pré-sélectionné succès pour gagné, échec pour perdu, aucun pour en pause ; « annulé » reste toujours possible (par ex. perdu parce que la personne a quitté la société).
- **Réactivation** : possible depuis les trois États, le Contact revient à son Étape actuelle ; l'Utilisateur peut ensuite la changer (par ex. retour à la première Étape pour une reprospection). Pas de verrou : le signalement « déjà exposé » suffit.
- **Seul un Contact actif commence un Essai** : utiliser un Positionnement sur un Contact non actif propose de le réactiver, dans la même action.
- **Historique** : chaque changement d'État est une Interaction datée (avec son motif le cas échéant), comme un changement d'Étape.
- **Relances** : en pause, elles sont conservées, et la pause peut porter une date de reprise sous forme d'une Relance « reprendre contact ». La date passée ne réactive pas le Contact automatiquement : c'est la Relance qui le rappelle à l'Utilisateur. Passer en perdu ou gagné **propose** d'annuler les Relances futures, sans l'imposer. Le cycle de vie d'une Relance relève du ticket [Interactions, Relances et rattachement aux Essais](06-interactions-relances-essais.md).
