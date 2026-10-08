# 05: Planificateur, alertes et erreurs du navigateur

**What to build:** l'API fait tourner ses tâches planifiées dans son propre processus, signale qu'elle vit à uptime-kuma, et toute exception imprévue (côté API ou navigateur) déclenche une alerte Pushover via uptime-kuma, sans contenu utilisateur. Sources : spec stack §10.6, §11.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Module `jobs` : boucle toutes les 15 min, tâches idempotentes en SQL, appelables directement depuis les tests
- [ ] Interface d'alerte injectée dans `createApp` : `up` toutes les 5 min, `down` sur toute exception imprévue ; `UPTIME_KUMA_PUSH_URL` facultatif (rien n'est envoyé sans lui)
- [ ] `POST /api/client-errors` : journalise puis `down` ; la SPA y envoie ses erreurs non rattrapées (la session sera exigée dès que l'auth existe, ticket 06)
- [ ] Au `SIGTERM`, l'API attend au plus ~5 s les envois en vol
- [ ] Tests : une exception dans une route déclenche `down` sans corps ni contenu utilisateur ; la boucle appelle chaque tâche enregistrée
