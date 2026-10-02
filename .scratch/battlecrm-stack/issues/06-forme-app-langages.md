# Forme de l'app et langages

Type: grilling
Status: open
Blocked by: 01, 02, 04, 11

## Question

Quelle forme prend l'app, et avec quels langages et frameworks ?

À trancher :
- SPA + API séparée, ou framework full-stack (rendu serveur) ; ce que chaque option implique pour l'extension Firefox (même API) et le hors-ligne en consultation.
- Le langage et le framework backend : **TypeScript (Hono, NestJS ou AdonisJS), Rust ou Go** (C# / .NET écarté par préférence de Romain), à la lumière de « Candidats backend » et de « Rust, Go et TypeScript au banc d'essai ».
- Le framework front et les bibliothèques d'interface, parmi les finalistes de « Candidats front ».
- Poids de la couverture auth (« Auth : ce que couvrent les bibliothèques ») dans le choix de l'écosystème, sachant qu'écrire soi-même n'est pas un défaut en soi (une dépendance en moins).
