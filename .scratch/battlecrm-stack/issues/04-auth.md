# Auth : ce que couvrent les bibliothèques

Type: research
Status: open
Blocked by:

## Question

Dans les écosystèmes backend candidats, quelles bibliothèques d'authentification couvrent les exigences ST-10 à ST-23 de la spec UX, et que resterait-il à écrire soi-même ?

À couvrir :
- Grille de couverture par bibliothèque (Better Auth, Auth.js, AdonisJS auth, ASP.NET Identity, phx.gen.auth, bibliothèques Go…) : inscription ouverte ou fermée par configuration (ST-10), vérification et réinitialisation par liens à usage unique et durée limitée (ST-12), non-énumération (ST-13), mots de passe fuités (ST-14, k-anonymity Have I Been Pwned), limitation des tentatives par compte et par origine (ST-15), sessions longues glissantes listées et révocables (ST-16), nouvel appareil (ST-17), TOTP et codes de secours (ST-18), récupération différée du second facteur (ST-19), réauthentification (ST-20), purge des inscriptions non vérifiées (ST-21).
- Sessions par cookie ou par jeton ; comment un **client extension Firefox** s'authentifie auprès de la même API (cookies tiers, jetons, flux dédié).
- Maturité, sécurité (historique de failles), maintenance, risque d'abandon (cf. Lucia).

Livrable : `.scratch/battlecrm-stack/research/04-auth.md`, avec sources primaires, la grille de couverture et une recommandation par écosystème.
