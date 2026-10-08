# Contrat d'API pour l'extension

Type: grilling
Status: open
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
