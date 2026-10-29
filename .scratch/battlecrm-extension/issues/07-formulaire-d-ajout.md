# Formulaire d'ajout depuis LinkedIn

Type: grilling
Status: open
Blocked by: 04, 06

## Question

En quoi l'ajout depuis LinkedIn s'écarte-t-il de l'ajout rapide de la SPA (spec UX §6) ?

- Champs visibles et champs pré-remplis ; ce que l'Utilisateur corrige.
- **Organisation lue sur LinkedIn** : rapprochement avec les Organisations existantes (normalisation de `packages/domain`), création à la volée et moment où l'on demande son type (ESN ou client final), cas « aucune Organisation ».
- État : Vivier par défaut, En prospection (avec l'Étape) ou Allié, comme l'ajout rapide ? `Entrée` et `Ctrl Entrée` ont-ils un sens ici ?
- Doublons : URL bloquante (ne devrait pas arriver, puisque la présence est connue avant) ; nom, e-mail, téléphone informatifs : l'extension a-t-elle les données pour le faire ?
- Après l'ajout : retour à l'état « déjà un Contact », « Annuler » (`undoToken`, ADR 0011) dans l'extension ?
