# Observabilité

Type: grilling
Status: resolved
Blocked by:

## Question

Comment Romain sait-il que l'app va mal sur le VPS (panne, erreurs, tâches ou e-mails en échec), sans service payant ?

À trancher :
- **Journaux** : format (JSON structuré ou texte), bibliothèque (pino…), niveaux, identifiant de requête, ce qu'on ne journalise jamais (mots de passe, jetons, contenu des Contacts et des notes, e-mails), durée de conservation.
- **Erreurs** : comment une exception non prévue de l'API ou de la SPA remonte à Romain. Simple lecture des journaux, table d'erreurs en base, Sentry auto-hébergé (lourd sur le VPS) ou GlitchTip ? Faut-il remonter les erreurs du navigateur ?
- **Santé et alertes** : contenu de `/api/health` (base joignable, migrations à jour, version) ; branchement sur l'uptime-kuma déjà présent sur le VPS, et canal d'alerte (e-mail, notification…).
- **Échecs silencieux à rendre visibles** :
  - les e-mails dont l'envoi a échoué (seulement journalisés, sans reprise, d'après « [E-mails transactionnels traduits](14-e-mails.md) ») ;
  - les tâches du planificateur `jobs` en échec ;
  - les retours automatiques de `deploy.sh` (ADR 0013) ;
  - les sauvegardes, une fois tranchées (« [Sauvegardes et RGPD avant d'ouvrir les inscriptions](17-sauvegardes-et-rgpd.md) »).
- **Mesures** : en faut-il (temps de réponse des gestes, pour la fluidité visée) ou les journaux suffisent-ils ?

Déjà là : rotation des journaux Docker, `/api/health` utilisé par `deploy.sh`, uptime-kuma sur le VPS, journal d'accès de Traefik (« [Relevé du VPS](05-releve-vps.md) »). Entrées : « [Déploiement](10-deploiement.md) », « [Architecture : où vivent les règles du domaine](09-architecture.md) ».

## Answer

Tranché avec Romain le 2026-10-08. Consigne : **rester très simple**, aucun service ni table ajoutés. Fait établi : l'uptime-kuma du VPS notifie déjà Romain par **Pushover**, instantanément.

- **Journaux** : **pino**, JSON sur stdout. Une ligne par requête : méthode, route modèle (`/contacts/:id`), statut, durée, `userId`, `requestId`. S'y ajoutent les événements notables. Niveau `info` en prod, `debug` en dev avec `pino-pretty` (dépendance de dev). Le `requestId` est posé par le middleware `requestId` de Hono et renvoyé dans `X-Request-Id`.
- **Jamais journalisé** : mots de passe, jetons (session, réinitialisation, vérification, `undoToken`), cookies, `Authorization`, codes 2FA, corps de requête et de réponse, contenu des Contacts, Organisations, notes, Interactions et pièces jointes. Adresses e-mail masquées (`r***@gmail.com`). Pas d'IP non plus, puisque le journal d'accès de Traefik les a déjà. Garde-fous : `redact` de pino sur les chemins connus, on ne journalise jamais un objet entier (seulement des champs choisis), et un test vérifie qu'une connexion ne laisse ni mot de passe ni jeton dans la sortie.
- **Conservation** : la rotation Docker existante (`json-file`, 3 × 10 Mo), soit plusieurs semaines, une durée bornée compatible avec l'anonymisation. Pas de collecteur. Lecture par `docker compose logs api | jq`.
- **`GET /api/health`** : public, sans session. Il lance `SELECT 1` et vérifie que la dernière migration connue de cette version est appliquée (**« au moins à jour », jamais « égal »**, sinon l'ancienne API d'un retour arrière, sur un schéma plus récent, serait déclarée malade). Il répond 200 `{ status, version }` ou 503 sans détail. Il ne regarde ni le SMTP ni les tâches : un Gmail en panne ne doit jamais déclencher de retour arrière. Le même contrôle sert au healthcheck Docker, à `deploy.sh` et à uptime-kuma.
- **Alertes** : uptime-kuma → Pushover, la seule centrale d'alerte.
  - un moniteur **HTTP** sur `/api/health` ;
  - un moniteur **push « BattleCRM API »**. Le planificateur `jobs` y envoie `status=up` toutes les 5 min (preuve que l'API et ses tâches tournent ; sans ping pendant ~10 min, alerte). Toute exception imprévue (requête, tâche, envoi d'e-mail en échec) est journalisée en `error` avec son `requestId`, puis l'API envoie `status=down&msg=…` (type d'erreur, route ou tâche ; **jamais** de contenu utilisateur). uptime-kuma ne notifie qu'au changement d'état, ce qui dédoublonne : au plus une alerte par 5 min, et le `up` suivant ramène le vert ;
  - `UPTIME_KUMA_PUSH_URL` dans `api.env`, facultatif : absent en dev et en test, donc aucun ping. Le ping passe par une petite interface injectée dans `createApp` (faux en test, comme `email` ; voir « [Stratégie de test](15-strategie-de-test.md) »).
- **Échecs silencieux** :
  - un e-mail en échec ou une tâche en échec déclenche le `down` ;
  - un planificateur mort se voit à l'absence de `up` ;
  - un retour automatique de `deploy.sh` fait échouer le workflow `release`, et GitHub l'envoie déjà par e-mail ;
  - pour les sauvegardes, un moniteur push distinct, pingé après un dump réussi (détail : « [Sauvegardes et RGPD avant d'ouvrir les inscriptions](17-sauvegardes-et-rgpd.md) »).
- **Erreurs du navigateur** : `POST /api/client-errors` (session requise), qui journalise le message, la pile et la version du front, puis envoie le même `down`. Pas de stockage ni de source maps : on reproduit en local.
- **Mesures** : aucune pile de métriques, la durée sur chaque ligne de journal suffit.
- **Écarté** : Sentry et GlitchTip auto-hébergés (lourds sur le VPS), une table d'erreurs avec alerte par e-mail, le contrôle SMTP quotidien, `Server-Timing`, Loki.
- Pas d'ADR (tout est réversible). Pas de nouveau terme dans `CONTEXT.md`.
