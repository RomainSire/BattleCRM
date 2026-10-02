# Auth : ce que couvrent les bibliothèques

Type: research
Status: resolved
Blocked by:

## Question

Dans les écosystèmes backend candidats, quelles bibliothèques d'authentification couvrent les exigences ST-10 à ST-23 de la spec UX, et que resterait-il à écrire soi-même ?

À couvrir :
- Grille de couverture par bibliothèque (Better Auth, Auth.js, AdonisJS auth, ASP.NET Identity, phx.gen.auth, bibliothèques Go…) : inscription ouverte ou fermée par configuration (ST-10), vérification et réinitialisation par liens à usage unique et durée limitée (ST-12), non-énumération (ST-13), mots de passe fuités (ST-14, k-anonymity Have I Been Pwned), limitation des tentatives par compte et par origine (ST-15), sessions longues glissantes listées et révocables (ST-16), nouvel appareil (ST-17), TOTP et codes de secours (ST-18), récupération différée du second facteur (ST-19), réauthentification (ST-20), purge des inscriptions non vérifiées (ST-21).
- Sessions par cookie ou par jeton ; comment un **client extension Firefox** s'authentifie auprès de la même API (cookies tiers, jetons, flux dédié).
- Maturité, sécurité (historique de failles), maintenance, risque d'abandon (cf. Lucia).

Livrable : `.scratch/battlecrm-stack/research/04-auth.md`, avec sources primaires, la grille de couverture et une recommandation par écosystème.

## Comments

- Recherche disponible sur la branche `research/04-auth`, fichier `.scratch/battlecrm-stack/research/04-auth.md` (`git show research/04-auth:.scratch/battlecrm-stack/research/04-auth.md`).

## Answer

Détail, grille de couverture et sources : la recherche ci-dessus. Faits établis, sur lesquels s'appuieront « Forme de l'app et langages » et « Auth : bibliothèque, sessions et client extension » :

- **Aucune bibliothèque ne couvre ST-10 à ST-23.** Partout à écrire : récupération différée du second facteur (ST-19), purge des inscriptions non vérifiées (ST-21), nouvel appareil (ST-17), plus le second facteur exigé à la réinitialisation, la réauthentification systématique (ST-20) et les e-mails traduits.
- **TypeScript : Better Auth** couvre le plus (fermeture des inscriptions, HIBP, TOTP et 10 codes de secours, sessions en base listables et révocables, jeton bearer) ; limitation par IP seulement, celle par compte est à écrire. **Revers : la maintenance** (37 avis de sécurité dont 3 critiques, certains dans le cœur ; racheté par Vercel en juillet 2026) : plugins au minimum, `cookieCache` désactivé, veille hebdomadaire. Écartés : Auth.js (en maintenance), Lucia et oslo (abandonnés), AdonisJS auth (parcours derrière un kit payant).
- **.NET : ASP.NET Core Identity** (.NET 10 LTS) : le plus stable ; verrouillage par compte, TOTP et codes de secours, jetons natifs. Mais `MapIdentityApi` inutilisable (énumération, pas de sessions listées) : endpoints, `ITicketStore` en base, validateur HIBP et règles de mot de passe à écrire ; rotation des clés DataProtection à prévoir.
- **Phoenix : `phx.gen.auth`** : code possédé, sessions en base, mode sudo, mais centré sur le lien magique ; réinitialisation, TOTP et limitation à ajouter.
- **Go** : pas de bibliothèque complète vivante ; auth écrite à la main (Kratos ajouterait un service).
- **Client extension** : **jeton de session opaque dédié**, en bearer depuis le script d'arrière-plan, stocké dans `storage.local`, listé dans « Appareils connectés » et révocable comme les autres. Réutiliser le cookie web forcerait un joker CSRF (origine `moz-extension://` aléatoire) ; OAuth/PKCE disproportionné.
- **Classement** : Better Auth et Identity ex æquo (le moins de code contre le moins de maintenance), puis Phoenix, puis Go. **Sessions opaques en base** dans tous les cas.
- **À vérifier, au besoin par un spike** : vérification d'une inscription commencée quand Better Auth a fermé les inscriptions ; nombre de codes de secours restants exposé ; cookie et Total Cookie Protection si on réutilisait le cookie web.
