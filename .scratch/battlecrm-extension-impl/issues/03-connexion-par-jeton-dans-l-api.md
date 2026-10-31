# 03: Connexion par jeton (`bearer`) dans l'API

**What to build:** l'API accepte, en plus du cookie, une session portée par `Authorization: Bearer`, celle que l'extension ouvrira par mot de passe puis second facteur. Cette session a les mêmes droits et les mêmes refus que le cookie, apparaît « Extension Firefox » dans « Appareils connectés » et se révoque comme les autres. Une extension trop ancienne reçoit `426`. Sources : [spec extension](../../battlecrm-extension/spec.md) §8 ; spec stack §9 ; ST-90, ST-91, ST-92 ; [research/18](../../battlecrm-stack/research/18-extension-firefox-auth.md).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Plugin `bearer` de Better Auth : même ligne `session` que le cookie (90 j glissants), jeton rendu à la connexion (mot de passe puis code 2FA), `POST /sign-out` en bearer révoque la session
- [x] Une seule liste d'origines de confiance : l'origine de l'app et `moz-extension://` (tout uuid), partagée par `trustedOrigins` et `csrf()` ; un POST qui porte `Origin: moz-extension://<uuid>` passe, une autre origine est refusée
- [x] Session de l'extension nommée « Extension Firefox » dans « Appareils connectés » (d'après `X-Client`), révocable une à une
- [x] `X-Client: extension/<version>` lu ; en dessous de la constante `MIN_EXTENSION_VERSION` (première version qui contiendra l'extension), réponse `426` ; sans `X-Client` (la SPA), rien ne change
- [x] Tests de sécurité générés dans les deux modes (cookie et bearer), mêmes refus ; instantané des routes de Better Auth à jour
- [ ] Suggéré, jamais obligatoire : les points 🔎 de research/18 vérifiés dans un vrai Firefox quand l'extension existe (ticket 04)
- [x] Migration `0048_session_client` appliquée à la base de dev

## Comments

**2026-10-31, implémentation (agent).**

- Plugin `bearer({ requireSignature: true })` (`apps/api/src/auth/better-auth.ts`) : le jeton est la valeur signée du cookie de session, donc la même ligne `session` ; le jeton brut, sans signature, est refusé. `native()` (`auth/index.ts`) transmet `Authorization` et `X-Client` à Better Auth, sauf au second facteur, qui n'envoie que le défi.
- Jeton et défi rendus **à l'extension seule** (`X-Client: extension/…`) : `POST /auth/sign-in/email` répond `{ email, token }`, ou `{ twoFactorRequired, challenge }` avec un second facteur ; `verify-totp` et `verify-backup-code` prennent `{ code, challenge }` (en `credentials: 'omit'`, le cookie du défi ne voyage pas) et répondent `{ email, token }`. La SPA ne reçoit ni l'un ni l'autre, et un `challenge` dans le corps venant d'elle est ignoré. Décision prise avec Romain le 2026-10-31.
- Origines : `config.trustedOrigins` = `[APP_ORIGIN, 'moz-extension://']`, lu par Better Auth et par `csrf()` via `isTrustedOrigin` (même lecture que Better Auth : un schéma seul couvre toutes ses origines).
- « Appareils connectés » : colonne `session.client` (migration `0048_session_client`, champ additionnel de Better Auth), posée à la création par un `databaseHooks.session.create.before` d'après `X-Client` ; `GET /api/sessions` ajoute `extension` ; la web affiche « Extension Firefox · <système> ». Chaque connexion de l'extension compte comme un nouvel appareil (e-mail de sécurité).
- `426` : `apps/api/src/client-version.ts`, seul lecteur de `X-Client` ; `MIN_EXTENSION_VERSION = '0.7.0'`, la version actuelle de l'app, pour que l'extension en dev (qui porte 0.7.0) passe ; toute version publiée de l'extension sera au moins celle-là. Une version illisible reçoit aussi `426`.
- Tests : `auth/bearer.test.ts` ; les tests générés `routes.test.ts` (sans session) et `security.test.ts` (accès croisé) tournent en `cookie` et en `bearer`. L'instantané des routes de Better Auth est inchangé : `bearer` n'ajoute aucun endpoint.
- Laissé aux tickets suivants : la demande « second facteur perdu » (ST-19) ne lit que le cookie du défi, l'extension ne la propose pas. Les points 🔎 de research/18 restent à voir dans un vrai Firefox avec le ticket 04 (suggéré).
