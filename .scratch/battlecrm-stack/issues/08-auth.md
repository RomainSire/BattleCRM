# Auth : bibliothèque, sessions et client extension

Type: grilling
Status: open
Blocked by: 04, 06, 07

## Question

Comment l'auth est-elle réalisée ?

À trancher :
- Bibliothèque retenue, ou code maison, et ce qui reste à écrire pour couvrir ST-10 à ST-23.
- Sessions web (cookie, durée glissante, révocation) et authentification du client extension Firefox.
- Où vit la variable d'environnement qui ouvre ou ferme les inscriptions, et ce qu'elle pilote (ST-10).
