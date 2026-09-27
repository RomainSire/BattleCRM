# Évolution du Funnel en cours de route

Type: grilling
Status: resolved
Blocked by:

## Question

Que se passe-t-il quand l'Utilisateur modifie son Funnel alors qu'il porte déjà des Contacts, des Positionnements, des Battles et un historique ?

À trancher :
- **Renommer** une Étape : sans effet (même Étape) ?
- **Réordonner** : quel effet sur le sens « avant / arrière » d'un changement d'Étape (popup succès/échec de l'Essai) et sur l'historique déjà enregistré ?
- **Supprimer** une Étape qui a des Contacts, des Positionnements, une Battle ouverte, un Historique des Champions : interdit, archivage, déplacement des Contacts vers une autre Étape ?
- **Ajouter** une Étape au milieu : les Contacts existants la « sautent »-ils implicitement ?

## Answer

Tranché en grilling avec Romain (2026-09-27). Termes intégrés à `CONTEXT.md` (Funnel, Étape, État).

- **Renommer** : l'Étape a une identité propre, indépendante de son nom ; le nom courant s'affiche partout, historique compris.
- **Réordonner** : permis à tout moment, même avec des Battles ouvertes, sans signal. Le sens « avant / arrière » d'un changement d'Étape (qui pré-remplit la popup de l'Essai) se lit dans l'ordre en vigueur au moment du changement ; le sens n'est pas figé et l'historique n'est jamais recalculé. Cohérent avec la limite assumée d'[Attribution quand plusieurs Battles touchent un même Contact](07-attribution-plusieurs-battles.md).
- **Retirer** : une Étape qui a servi est **archivée**, jamais supprimée. Conditions : aucune Battle ouverte (la clore d'abord, au besoin en « abandonnée ») et aucun Contact actif ou en pause à cette Étape (l'Utilisateur les déplace d'abord, éventuellement en masse, chaque déplacement étant tracé comme un changement d'Étape ; il n'y a pas d'Essai en cours à régler, faute de Battle ouverte). Les Contacts perdus ou gagnés gardent l'Étape archivée comme dernière Étape atteinte. Ses Positionnements, Battles et Historique des Champions restent consultables. Suppression réelle seulement pour une Étape qui n'a jamais servi (ni Contact, ni Interaction, ni Positionnement).
- **Restaurer** : une Étape archivée revient telle quelle, avec ses Positionnements, son Champion et son Historique des Champions.
- **Ajouter au milieu** : rien de rétroactif, les Contacts déjà plus loin l'ont sautée. La nouvelle Étape démarre sans Champion ; sa première Battle demande un Champion initial.
- **Invariants** : au moins une Étape non archivée ; un nouveau Contact entre à la première Étape non archivée du moment. Pas de fusion d'Étapes (déplacer les Contacts puis archiver).
- **Réactivation** d'un Contact dont l'Étape est archivée : l'Utilisateur choisit une Étape non archivée, et ce déplacement est tracé comme un changement d'Étape.

Pas d'ADR : l'archivage est facile à revoir et ne surprend pas.
