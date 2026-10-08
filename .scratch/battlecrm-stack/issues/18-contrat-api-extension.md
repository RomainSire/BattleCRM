# Contrat d'API pour l'extension

Type: grilling
Status: resolved
Blocked by:

## Question

Que doit garantir la stack pour que l'extension Firefox LinkedIn s'y branche sans retouche, sans concevoir l'extension ?

À trancher :
- **Authentification** : comment l'extension obtient sa session (connexion dans l'extension, ou reprise de la session de l'app ouverte dans le navigateur), et ce qu'implique le jeton `bearer` (stockage dans l'extension, durée, révocation dans la liste des sessions, ST-16). Faut-il une portée réduite (seulement certains gestes) ou les mêmes droits que la SPA ?
- **CORS et origine** : `moz-extension://<uuid>` dans `trustedOrigins`. L'uuid varie selon l'installation : comment le déclarer, et faut-il fixer l'identifiant de l'extension ?
- **Surface exposée** : quels endpoints l'extension utilisera vraisemblablement (chercher un Contact ou une Organisation, créer un Contact, noter une Interaction), et s'ils suivent la même règle « un endpoint par geste ». Faut-il un endpoint dédié (création depuis un profil LinkedIn) ou rien de spécial ?
- **Versionnement** : l'extension se met à jour à son rythme, pas à celui de la SPA. Faut-il une fenêtre de compatibilité plus longue que « N-1 » (« [Déploiement](10-deploiement.md) ») ? Faut-il un endpoint ou un en-tête de version minimale, et que fait l'extension quand elle est trop vieille ?
- **Client typé** : l'extension réutilise-t-elle `packages/contract` et le client RPC `hc<AppType>` (donc vit-elle dans le monorepo) ?
- **Limitation et sécurité** : quotas par session de l'extension, et effet sur les tests de sécurité générés (« [Stratégie de test](15-strategie-de-test.md) »).

Déjà tranché : session normale, plugin `bearer` à activer plus tard, origine `moz-extension://` à déclarer (« [Auth : bibliothèque, sessions et client extension](08-auth.md) ») ; `X-App-Version` et endpoints compatibles avec la version précédente (« [Déploiement](10-deploiement.md) »). Hors périmètre : conception de l'extension et de l'import de Contacts.

## Answer

Tranché le 2026-10-08. Faits établis par la recherche [Extension Firefox et Better Auth](../research/18-extension-firefox-auth.md) (lecture du code de Firefox et de `better-auth@1.7.7`, rien essayé dans un vrai Firefox : à vérifier au début du chantier extension).

- **Session** : connexion dans l'extension (mot de passe puis 2FA), plugin `bearer` ; jeton dans `browser.storage.local`, même ligne `session` que le cookie (90 j glissants, listée « Extension Firefox » dans « Appareils connectés », révocable, ST-16). L'extension appelle l'API en `credentials: 'omit'` pour ne jamais mêler le cookie de l'app au jeton. Écarté : reprendre le cookie de l'app (comportement de Firefox non documenté, cassé en conteneur et en fenêtre privée, lié à la session de l'onglet).
- **Droits** : les mêmes que la SPA, sans portée réduite ; la réauthentification protège déjà les actions sensibles.
- **Origine** : aucun CORS (le background contourne CORS grâce à `host_permissions` ; les content scripts passent par lui). Une **seule liste d'origines** dans la configuration : l'origine de l'app et `moz-extension://` (tout uuid, qui change à chaque profil), partagée par `trustedOrigins` de Better Auth et par le contrôle d'origine des routes Hono métier (`csrf()`). `browser_specific_settings.gecko.id` fixé (signature AMO, `update_url`).
- **Surface** : rien de spécial ; les endpoints « un par geste » de la SPA. Un geste propre à l'extension (« depuis un profil LinkedIn ») sera un endpoint comme les autres, conçu avec l'extension. Garantie : aucun endpoint ne suppose la SPA (ni cookie d'appareil, ni en-tête propre à la SPA).
- **Client** : `apps/extension` dans le monorepo, réutilise `packages/contract`, `packages/domain`, `packages/i18n` et le client RPC `hc<AppType>`, même outillage ; même numéro de version que l'app.
- **Versions** : la règle N-1 (expand/contract) reste la seule fenêtre. L'extension envoie `X-Client: extension/<version>` ; un middleware compare à la constante `MIN_EXTENSION_VERSION` du code et répond `426` (« mets à jour l'extension ») ; on ne la monte que quand une étape « contract » casse l'extension.
- **Limitation et tests** : aucun quota propre (ratelimit Traefik par IP et compteurs de connexion de Better Auth). Quand `bearer` est activé, les tests de sécurité générés (inventaire des routes, accès croisé, filtre oublié) tournent pour les deux modes : cookie et jeton doivent donner exactement les mêmes refus.
- Pas d'ADR (réversible, prolonge « Auth : bibliothèque, sessions et client extension »). Pas de nouveau terme dans `CONTEXT.md`.
