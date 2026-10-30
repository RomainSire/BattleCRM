# 03: Connexion par jeton (`bearer`) dans l'API

**What to build:** l'API accepte, en plus du cookie, une session portée par `Authorization: Bearer`, celle que l'extension ouvrira par mot de passe puis second facteur. Cette session a les mêmes droits et les mêmes refus que le cookie, apparaît « Extension Firefox » dans « Appareils connectés » et se révoque comme les autres. Une extension trop ancienne reçoit `426`. Sources : [spec extension](../../battlecrm-extension/spec.md) §8 ; spec stack §9 ; ST-90, ST-91, ST-92 ; [research/18](../../battlecrm-stack/research/18-extension-firefox-auth.md).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Plugin `bearer` de Better Auth : même ligne `session` que le cookie (90 j glissants), jeton rendu à la connexion (mot de passe puis code 2FA), `POST /sign-out` en bearer révoque la session
- [ ] Une seule liste d'origines de confiance : l'origine de l'app et `moz-extension://` (tout uuid), partagée par `trustedOrigins` et `csrf()` ; un POST qui porte `Origin: moz-extension://<uuid>` passe, une autre origine est refusée
- [ ] Session de l'extension nommée « Extension Firefox » dans « Appareils connectés » (d'après `X-Client`), révocable une à une
- [ ] `X-Client: extension/<version>` lu ; en dessous de la constante `MIN_EXTENSION_VERSION` (première version qui contiendra l'extension), réponse `426` ; sans `X-Client` (la SPA), rien ne change
- [ ] Tests de sécurité générés dans les deux modes (cookie et bearer), mêmes refus ; instantané des routes de Better Auth à jour
- [ ] Suggéré, jamais obligatoire : les points 🔎 de research/18 vérifiés dans un vrai Firefox quand l'extension existe (ticket 04)
