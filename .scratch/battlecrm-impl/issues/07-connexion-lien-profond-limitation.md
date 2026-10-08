# 07: Connexion, lien profond et limitation

**What to build:** un Utilisateur se connecte et se déconnecte ; un lien profond le ramène à la page demandée ; les tentatives répétées ralentissent puis bloquent 15 minutes, sans jamais révéler si l'adresse existe. Sources : spec UX §5.9 ; spec stack §7 ; ST-13, ST-15, ST-22.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Écran de connexion : un seul message d'erreur, collage et gestionnaires de mots de passe autorisés ; `customSyntheticUser` contre l'énumération
- [ ] Destination dans un paramètre de recherche typé, rejouée après la connexion (ST-22)
- [ ] Se déconnecter (cet appareil, sans confirmation) ; données locales de l'appareil effacées (le résumé arrive au ticket 13 : le point de purge est en place)
- [ ] Limiteur de Better Auth par IP, stockage `database`, `trustedProxies` sur Traefik, 30 tentatives / 15 min
- [ ] Table `login_attempt` par compte : 5 échecs en 15 min puis délai croissant, 10 échecs puis blocage 15 min, message « Trop de tentatives. Réessaie dans 15 minutes, ou réinitialise ton mot de passe. »
- [ ] `hooks.before` force `trustDevice: false`, prouvé par un test (spec stack §15)
- [ ] Tests de sécurité générés : inventaire des routes (401 ou 404 sans session), garde-fous d'auth
- [ ] Ménage des sessions expirées et des compteurs par le planificateur (si le ticket 05 est fait)
