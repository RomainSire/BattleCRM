# Auth : bibliothèque, sessions et client extension

Type: grilling
Status: open
Blocked by: 04, 06, 07

## Question

Comment l'auth est-elle réalisée ?

À trancher :
- **Better Auth est retenu** (« [Forme de l'app et langages](06-forme-app-langages.md) ») : son réglage minimal (plugins gardés, surface exposée), et ce qui reste à écrire pour couvrir ST-10 à ST-23 (au moins ST-17, ST-19, ST-21).
- Sessions web (cookie, durée glissante, révocation) et authentification du client extension Firefox.
- Côté données, déjà tranché par « [Base de données et accès aux données](07-donnees.md) » : adaptateur Drizzle, `better-auth` ≥ 1.7.7, tables hors RLS. Reste : stockage des compteurs de limitation (mémoire ou base) au regard de ST-15 (par compte et par origine, blocage de 15 min) ; Better Auth accepte-t-il des `user.id` en UUID v7 générés par la base ?
- Où vit la variable d'environnement qui ouvre ou ferme les inscriptions, et ce qu'elle pilote (ST-10).
