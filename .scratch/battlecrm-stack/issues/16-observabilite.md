# Observabilité

Type: grilling
Status: open
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
