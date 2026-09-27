# Règle de victoire bayésienne, avec garde-fous mais sans verrou

Avec 10 à 25 Essais par Positionnement, un test fréquentiste ne conclut presque jamais. Une Battle est donc tranchée par une approche bayésienne bêta-binomiale : elle est concluante quand P(Challenger > Champion) ≥ 0,85, ou ≤ 0,15 si c'est le Champion qui l'emporte. Aucun verdict n'est possible avant 10 Essais terminés par Positionnement et 5 succès au total, et un Horizon de 25 Essais commencés par Positionnement ferme la Battle. Si l'Horizon est atteint sans verdict, c'est une égalité et le Champion garde son titre. Nous acceptons en connaissance de cause environ 20 à 30 % de « vainqueurs » entre deux Positionnements en réalité équivalents : se tromper ne coûte presque rien et le titre est remis en jeu à la Battle suivante. Détail et sources : `.scratch/battlecrm/research/01-methode-statistique.md`.

## Conséquences

- Seuil et Horizon sont fixés à l'ouverture de la Battle puis figés : les modifier en cours de route permettrait d'obtenir le vainqueur qu'on souhaite. Le minimum n'est pas réglable.
- Rien n'est automatique : l'app signale qu'une Battle est concluante, mais c'est l'Utilisateur qui confirme la clôture. Il peut aussi déclarer n'importe quel vainqueur à tout moment, même contre les données, après un avertissement. Ce choix est délibéré (pas de verrou) et la trace préserve l'honnêteté : le Verdict est alors marqué « désigné par l'Utilisateur ».
- On n'arrête pas une Battle plus tôt pour égalité sur la perte attendue : ce cas est trop rare à ces volumes pour justifier une notion de plus.
