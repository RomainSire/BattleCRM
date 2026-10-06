# Auth : bibliothèque, sessions et client extension

Type: grilling
Status: open
Blocked by: 04, 06, 07

## Question

Comment l'auth est-elle réalisée ?

À trancher :
- **Better Auth est retenu** (« [Forme de l'app et langages](06-forme-app-langages.md) ») : son réglage minimal (plugins gardés, surface exposée), et ce qui reste à écrire pour couvrir ST-10 à ST-23 (au moins ST-17, ST-19, ST-21).
- Sessions web (cookie, durée glissante, révocation) et authentification du client extension Firefox.
- Où vit la variable d'environnement qui ouvre ou ferme les inscriptions, et ce qu'elle pilote (ST-10).
