# 05: Planificateur, alertes et erreurs du navigateur

**What to build:** l'API fait tourner ses tâches planifiées dans son propre processus, signale qu'elle vit à uptime-kuma, et toute exception imprévue (côté API ou navigateur) déclenche une alerte Pushover via uptime-kuma, sans contenu utilisateur. Sources : spec stack §10.6, §11.

**Blocked by:** 02

**Status:** resolved

- [x] Module `jobs` : boucle toutes les 15 min, tâches idempotentes en SQL, appelables directement depuis les tests
- [x] Interface d'alerte injectée dans `createApp` : `up` toutes les 5 min, `down` sur toute exception imprévue ; `UPTIME_KUMA_PUSH_URL` facultatif (rien n'est envoyé sans lui)
- [x] `POST /api/client-errors` : journalise puis `down` ; la SPA y envoie ses erreurs non rattrapées (la session sera exigée dès que l'auth existe, ticket 06)
- [x] Au `SIGTERM`, l'API attend au plus ~5 s les envois en vol
- [x] Tests : une exception dans une route déclenche `down` sans corps ni contenu utilisateur ; la boucle appelle chaque tâche enregistrée

## Comments

**2026-10-10, implémentation (agent).**

- **Alerte** (`apps/api/src/alert.ts`) : `Alert = { up(), down(reason) }`, injectée dans `createApp`. `uptimeKumaAlert` fait un `GET` sur l'URL de push avec `status` et `msg` (délai de 5 s), sans corps. `UPTIME_KUMA_PUSH_URL` s'arrête au jeton ; une chaîne de requête collée depuis uptime-kuma est remplacée, et une variable laissée vide vaut absente. Sans elle, `noAlert` n'envoie rien. Un ping en échec est journalisé en `warn` sans l'URL (elle porte le jeton) ni le message d'erreur. En test : `recordingAlert()` (`test/doubles.ts`), exposé par `testApp().alert`.
- **Ce que dit un `down`** : `failureReason(error, where)`, soit le type de l'erreur et la route modèle ou la tâche (`TypeError in POST /api/contacts/:id`, `RangeError in job purge`), jamais le message de l'erreur, qui peut citer du contenu. Une erreur du navigateur donne le texte fixe `browser error`. Une `HTTPException` n'alerte pas.
- **Planificateur** (`apps/api/src/jobs`) : `createScheduler({ jobs, alert, logger })`, avec `Job = { name, run() }`. Un seul battement de 5 min, les tâches une fois sur trois (15 min) et tout de suite au démarrage (une livraison ramène donc le moniteur au vert). Une tâche qui échoue est journalisée, alerte, et laisse tourner les suivantes. Le `up` d'un battement à tâches part **après** elles, et seulement si aucune n'a échoué (il couvrirait le `down`) ; tant qu'un tour est en cours, il n'est pas doublé et aucun `up` ne part : une tâche bloquée finit donc par alerter. **Aucune tâche n'existe encore** : `main.ts` passe `jobs: []`, chaque module y inscrira les siennes (tickets 06, 12…). Elles se testent par `job.run()` ou `scheduler.runJobs()`.
- **Envois en vol** (`apps/api/src/in-flight.ts`) : `createInFlight()` suit les envois lancés sans `await` ; au `SIGTERM`, `main.ts` arrête la boucle, ferme le serveur, attend le tour de tâches en cours, puis au plus 5 s les envois, puis ferme la base. **Le ticket 06 y inscrira les e-mails** (`inFlight.track(…)`).
- **Ajout hors liste** : `main.ts` alerte aussi sur une exception que rien n'a rattrapée (`uncaughtException`, rejet non géré compris), puis sort en code 1 pour que Docker relance l'API.
- **`POST /api/client-errors`** : `{ message, stack?, version }` (2 000, 20 000 et 50 caractères au plus, corps de 128 Ko au plus), validé par le `validator` de Hono et un schéma Zod local (`src/client-errors.ts`) : l'API n'importe toujours pas `@battlecrm/contract` (voir la note « À prévoir » du ticket 02). Réponse 204, 400 ou 413. **Public pour l'instant** : le ticket 06 doit y exiger la session. D'ici là, n'importe qui peut déclencher un `down` (uptime-kuma ne notifie qu'au changement d'état, et le `up` suivant ramène le vert).
- **SPA** (`apps/web/src/client-errors.ts`) : envoie les erreurs `error` et `unhandledrejection` de la page, et celles qu'attrape une frontière d'erreur React (`onCaughtError`, le routeur en pose une par route), au plus 5 par chargement de page ; un envoi en échec est abandonné sans bruit. La version vient de `VITE_APP_VERSION`, posée par l'argument `VERSION` de `apps/web/Dockerfile` (le workflow `release` le passait déjà), `dev` sinon.
- **Vérifié à la main** : l'API lancée contre un faux uptime-kuma envoie `up` au démarrage, `down` sur une erreur du navigateur, et attend la réponse d'un ping lent avant de s'arrêter au `SIGTERM`.
- **Revue, laissé tel quel** : le message et la pile d'une erreur du navigateur sont journalisés comme le demande la spec §11, alors qu'ils peuvent citer du contenu ; Hono ne passe à `onError` que les `Error` (un `throw` d'autre chose, ou une `HTTPException` 5xx, n'alerte pas) ; les limites 2 000 / 20 000 sont répétées dans la SPA faute de `@battlecrm/contract` importable par l'API.
- **Sur le VPS** : créer le moniteur push et renseigner `UPTIME_KUMA_PUSH_URL` dans `api.env` (`docs/ops/install.md`, étape 6).

**2026-10-10, mise en service sur le VPS (Romain, accompagné par l'agent).** Livré en `v0.2.0`.

- **Moniteur push « BattleCRM API »** : intervalle de battement de 600 s et non 300 (pour un moniteur push, c'est le délai sans ping avant la panne ; l'API bat toutes les 5 min), 0 nouvelle tentative. Vérifié à la main : un `up` et un `down` poussés notifient chacun tout de suite par Pushover. Le point laissé ouvert à l'implémentation (un `down` qui resterait « en attente ») est donc tranché par ce réglage.
- **`api.env`** : `UPTIME_KUMA_PUSH_URL` ajoutée, puis `v0.2.0` relivrée à la main pour que l'API la lise. `/opt/docker/battlecrm` est fermé aux autres comptes (750) : la commande est `sudo -u battlecrm-deploy /opt/docker/battlecrm/deploy.sh v0.2.0`, sans `cd`.
- **Vérifié en vrai** : `up` au démarrage de l'API (moniteur vert), puis un `POST /api/client-errors` valide donne 204, la notification de panne, et le retour au vert au `up` suivant.
- `docs/ops/install.md` mis à jour (étape 6 et « Livrer une version »).
