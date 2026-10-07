# Auth : bibliothèque, sessions et client extension

Type: grilling
Status: resolved
Blocked by: 04, 06, 07

## Question

Comment l'auth est-elle réalisée ?

À trancher :
- **Better Auth est retenu** (« [Forme de l'app et langages](06-forme-app-langages.md) ») : son réglage minimal (plugins gardés, surface exposée), et ce qui reste à écrire pour couvrir ST-10 à ST-23 (au moins ST-17, ST-19, ST-21).
- Sessions web (cookie, durée glissante, révocation) et authentification du client extension Firefox.
- Côté données, déjà tranché par « [Base de données et accès aux données](07-donnees.md) » : adaptateur Drizzle, `better-auth` ≥ 1.7.7, tables hors RLS. Reste : stockage des compteurs de limitation (mémoire ou base) au regard de ST-15 (par compte et par origine, blocage de 15 min) ; Better Auth accepte-t-il des `user.id` en UUID v7 générés par la base ?
- Où vit la variable d'environnement qui ouvre ou ferme les inscriptions, et ce qu'elle pilote (ST-10).

## Answer

Tranché avec Romain le 2026-10-07 ; ADR [0010 Better Auth sert de noyau, les parcours sensibles sont écrits autour](../../../docs/adr/0010-better-auth-en-noyau-parcours-ecrits-autour.md). Faits vérifiés sur better-auth 1.7.7 : [research/better-auth-reglages.md](../research/better-auth-reglages.md).

- **Surface** : Better Auth derrière une **liste blanche de chemins** dans Hono (le reste répond 404) ; plugins `twoFactor` et `haveIBeenPwned` seulement. Hors liste : `/sign-up/email`, `/change-email`, `/reset-password`. `hooks.before` force `trustDevice: false` sur les vérifications 2FA (aucune option serveur ne le désactive ; un test le prouve). `customSyntheticUser` pour qu'aucune réponse ne trahisse un compte par la forme de son id.
- **Identifiants** : `advanced.database.generateId: false`, la base génère `uuidv7()` pour les tables de Better Auth aussi.
- **Inscription (maison)** : chaque tentative est une ligne `pending_signup` (e-mail, empreinte du mot de passe, langue, fuseau, empreinte du jeton) ; le compte Better Auth (`user` + `account`) n'est créé qu'au clic, avec le mot de passe de *cette* tentative, les autres tentatives sur l'adresse invalidées ; le clic ouvre une session sur l'appareil. « Renvoyer le lien » émet un nouveau jeton pour la même tentative. Adresse déjà prise : même réponse, e-mail « Tu as déjà un compte ». Purge des tentatives à 7 jours (ST-21).
- **Inscriptions ouvertes/fermées (ST-10)** : `SIGNUPS_OPEN=true|false`, **fermé par défaut**, lu par l'API seule ; pilote le refus de l'inscription et `GET /api/config` (`{ signupsOpen }`) qui masque « Créer un compte » dans la SPA. La landing ne le lit pas. Une tentative commencée reste vérifiable porte fermée.
- **Mots de passe** : 15 à 128 caractères, aucune autre règle ; HIBP (k-anonymat) à l'inscription, au changement et à la réinitialisation ; **HIBP injoignable = refus** avec un message clair. Hachage **scrypt** par défaut de Better Auth.
- **Sessions (ST-16)** : opaques en base, `expiresIn` 90 j, `updateAge` 1 j (dernière activité au jour près), `cookieCache` désactivé (révocation immédiate) ; cookie `__Secure-`, HttpOnly, **SameSite=Lax** (Strict casserait l'arrivée par lien d'e-mail), CSRF par le contrôle d'origine. Jetons stockés en clair (chemin natif) : **les dumps doivent être chiffrés**. Révocation des autres sessions au changement (`revokeOtherSessions`) et à la réinitialisation.
- **Limitation (ST-15)** : compteurs **en base**. Par IP : limiteur de Better Auth (stockage `database`, `trustedProxies` réglé sur Traefik, sinon tout le monde tombe dans un seau partagé), 30 tentatives de connexion / 15 min. Par compte (maison, `hooks.before`/`after` sur la connexion, table `login_attempt`) : 5 échecs en 15 min puis délai croissant, 10 échecs puis blocage de 15 min même avec le bon mot de passe ; codes TOTP et de secours dans les mêmes compteurs ; une réinitialisation réussie lève le blocage.
- **Réauthentification (ST-20)** : le mot de passe accompagne **chaque** requête sensible, vérifié côté serveur, sans fenêtre. Sensibles : changer l'e-mail, changer le mot de passe, activer ou désactiver la 2FA, régénérer les codes de secours. Déconnecter un appareil ou tous les autres ne l'est pas.
- **Nouvel appareil (ST-17)** : cookie d'appareil `__Host-`, HttpOnly, aléatoire, longue durée, qui survit à la déconnexion ; empreinte en base (`known_device`). E-mail de sécurité à une connexion réussie (après la 2FA ; filtrer la session provisoire et les rotations dans `databaseHooks.session.create.after`) sans cookie connu ; rien pour la première session du compte. Le client extension compte comme un nouvel appareil.
- **2FA (ST-18)** : TOTP et 10 codes de secours natifs (mot de passe exigé par Better Auth) ; le **nombre de codes restants** sort par une route maison (non exposé nativement). E-mails d'activation (au premier `verify-totp` réussi) et de désactivation par `hooks.after`.
- **Récupération de la 2FA (ST-19, maison)** : depuis l'écran du code, mot de passe déjà validé ; e-mail d'alerte avec « Annuler » tout de suite, rappel à J-1 ; une connexion réussie avec un vrai code annule ; à J+7 la tâche planifiée désactive la 2FA et prévient. Table `two_factor_recovery`.
- **Fin de la réinitialisation (maison)** : la demande reste native (réponse neutre, lien de 1 h) ; la fin enchaîne jeton, code 2FA s'il est actif, nouveau mot de passe (HIBP), révocation de toutes les sessions, levée du blocage, session sur cet appareil, e-mail.
- **Changement d'e-mail (maison)** : mot de passe exigé, jeton à usage unique de 1 h envoyé à la nouvelle adresse, avertissement à l'ancienne, clic qui exige d'être connecté au même compte.
- **Tâches planifiées** : planificateur **dans le processus de l'API** (boucle toutes les 15 min, SQL idempotent, une seule instance) : purge ST-21, échéances ST-19, ménage des sessions expirées et des compteurs.
- **Client extension** : mêmes parcours (mot de passe puis 2FA), session normale marquée « Extension Firefox » dans « Appareils connectés », révocable. Le plugin `bearer` ne s'active qu'avec le chantier extension ; en V1 l'API n'accepte que le cookie.
- **Module** : un seul module `auth` dans l'API (configuration, liste blanche, parcours maison, hooks, tâches d'auth), seul à toucher les tables de Better Auth et `pending_signup`, `known_device`, `login_attempt`, `two_factor_recovery`, toutes **hors RLS** avec des `GRANT` limités ; il n'expose aux autres modules que « qui est l'Utilisateur de cette requête ». Son emplacement revient à « Architecture : où vivent les règles du domaine ».
