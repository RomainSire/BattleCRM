# 07: Connexion, lien profond et limitation

**What to build:** un Utilisateur se connecte et se déconnecte ; un lien profond le ramène à la page demandée ; les tentatives répétées ralentissent puis bloquent 15 minutes, sans jamais révéler si l'adresse existe. Sources : spec UX §5.9 ; spec stack §7 ; ST-13, ST-15, ST-22.

**Blocked by:** 06

**Status:** resolved

- [x] Écran de connexion : un seul message d'erreur, collage et gestionnaires de mots de passe autorisés ; `customSyntheticUser` contre l'énumération
- [x] Destination dans un paramètre de recherche typé, rejouée après la connexion (ST-22)
- [x] Se déconnecter (cet appareil, sans confirmation) ; données locales de l'appareil effacées (le résumé arrive au ticket 13 : le point de purge est en place)
- [x] Limiteur de Better Auth par IP, stockage `database`, `trustedProxies` sur Traefik, 30 tentatives / 15 min
- [x] Table `login_attempt` par compte : 5 échecs en 15 min puis délai croissant, 10 échecs puis blocage 15 min, message « Trop de tentatives. Réessaie dans 15 minutes, ou réinitialise ton mot de passe. »
- [x] `hooks.before` force `trustDevice: false`, prouvé par un test (spec stack §15)
- [x] Tests de sécurité générés : inventaire des routes (401 ou 404 sans session), garde-fous d'auth
- [x] Ménage des sessions expirées et des compteurs par le planificateur (si le ticket 05 est fait)

## Comments

**2026-10-11, implémentation (agent).**

- **Routes** : `POST /api/auth/sign-in/email` (200 `{ email }` et le cookie ; 401 `invalid_credentials` ; 429 `too_many_attempts` ; 400 `invalid`) et `POST /api/auth/sign-out` (204, avec ou sans session). Ce sont les deux chemins natifs de la liste blanche (`ALLOWED_NATIVE_ROUTES`), mais chacun a **sa route Hono** : elle valide les champs, fabrique elle-même la requête passée au handler de Better Auth (ni `rememberMe` ni `callbackURL`), et répond avec nos mots. Le jeton de session que Better Auth renvoie dans le corps n'atteint donc jamais le JavaScript. Il n'y a plus de passe-plat `/auth/*` : un chemin natif sans route répond 404 comme n'importe quel chemin inconnu.
- **Un seul message** : mot de passe faux et adresse inconnue donnent la même réponse (statut, corps, pas de cookie) ; Better Auth hache le mot de passe dans les deux cas. Côté écran, aucune règle sur le mot de passe (une longueur fausse est un mot de passe faux).
- **Limiteur par IP** : celui de Better Auth, `storage: 'database'` (table `rate_limit`), règle `/sign-in/email` à 30 par 15 min, actif dans tous les environnements. **Écart à la spec stack §7, à trancher** : `advanced.ipAddress.trustedProxies` n'est pas réglé. Better Auth ne voit que les en-têtes, il ne peut pas vérifier qui lui parle ; `client-ip.ts` le fait déjà (pair dans `TRUSTED_PROXIES`, sinon `X-Forwarded-For` ignoré). La route passe donc à Better Auth un `X-Forwarded-For` d'une seule valeur, l'adresse déjà résolue : une seule règle de confiance, celle du ticket 02. Prouvé par un test (une adresse annoncée par le client ne change pas le seau).
- **Limiteur par compte** : table `login_attempt`, **une ligne par adresse** (`failures`, `last_attempt_at`, `blocked_until`), hors RLS. Il compte par **adresse saisie**, pas par compte : une adresse sans compte ralentit et bloque pareil, sinon le blocage trahirait les comptes (ST-13). Branché dans `hooks.before` / `hooks.after` de Better Auth (`auth/login-attempts.ts`, `admit` puis `succeeded`).
  - Les échecs s'additionnent tant qu'il ne s'écoule pas 15 min sans essai (pas de fenêtre fixe : sa frontière offrirait 19 essais en deux minutes, relevé par la revue). Jusqu'à 5 échecs, rien. Ensuite l'essai attend avant d'être vérifié : 1, 2, 4, 8 puis 16 s, **comptées depuis l'essai précédent** (quelqu'un qui a pris son temps n'attend pas). Le ralentissement est une réponse lente, pas un message : la spec UX n'en prévoit qu'un, celui du blocage.
  - Au 10e échec, blocage de 15 min, bon mot de passe compris ; les essais refusés pendant le blocage ne comptent pas et ne le prolongent pas.
  - L'essai est **compté avant d'être vérifié**, sous verrou de ligne, et une réussite efface la ligne : des essais envoyés en même temps ne passent pas à plus de 10 (test).
  - `Clock` gagne `sleep(ms)` ; l'horloge de test avance au lieu d'attendre et garde les durées (`clock.slept`).
  - **Pour les tickets 09 et 11** : `loginAttempts.succeeded(email)` lève le blocage après une réinitialisation ; les codes TOTP et de secours passeront par `admit` / `succeeded`.
- **`trustDevice`** : `hooks.before` remet `trustDevice: false` dans tout corps qui le porte. Le plugin `twoFactor` n'est pas encore installé (ticket 11) : le test le prouve sur un endpoint de test ajouté aux vraies options (`betterAuthOptions`), par HTTP et par `auth.api`. Il échoue si on retire le hook (vérifié). **Ticket 11** : le rejouer sur `/two-factor/verify-totp`.
- **`customSyntheticUser`** : réglé, il donne un id en UUID v7 comme les vrais (`Random` gagne `bytes(n)`). Il ne sert que dans `/sign-up/email`, hors liste blanche : c'est une ceinture, prouvée par `auth.api.signUpEmail` sur une adresse prise.
- **Journal de Better Auth** : branché sur pino, niveau `error`, message seul. Les niveaux inférieurs nomment des adresses, et un refus de connexion n'est pas un événement.
- **Tâche `purge expired sessions and counters`** (module `auth`, toutes les 15 min) : sessions expirées, lignes `rate_limit` et `login_attempt` vieilles de plus de 15 min.
- **Migrations** `0003_login_limits` (tables) et `0004_login_limits_access` (`GRANT` au rôle applicatif). Deux tables neuves, rien de modifié : compatible avec la version précédente.
- **Tests de sécurité générés** : `routes.test.ts` lit `app.routes` ; toute route hors de la liste `PUBLIC_ROUTES` doit répondre 401 ou 404 sans session (cookie forgé compris). Une nouvelle route est couverte le jour où elle est écrite ; la rendre publique demande de l'ajouter à la liste. Garde-fous dans `better-auth.test.ts` : liste blanche servie, réglage du limiteur, sessions, `trustDevice`, id synthétique, champs de `rate_limit`.
- **SPA, lien profond (ST-22)** : sans session, une page de l'app renvoie à `/sign-in?redirect=<chemin, recherche et fragment>` ; le paramètre est validé par Zod (`zod` ajouté aux dépendances de la SPA) : un chemin de l'app seulement (ni second `/`, ni `\\`, ni blanc), toute autre valeur est ignorée (pas de redirection ouverte, test). Pas de paramètre quand la page demandée est « Aujourd'hui ». Avec une session, `/sign-in?redirect=…` mène droit à la page.
- **SPA, écran de connexion** : `autocomplete="username"` et `current-password`, bouton « Afficher », rien n'empêche le collage ; un seul message (« Adresse e-mail ou mot de passe incorrect. », libellé à valider), la phrase de la spec pour le blocage, « Quelque chose n'a pas fonctionné » sinon. La saisie est conservée après un refus.
- **SPA, se déconnecter** : composant `Account` (adresse du compte et « Se déconnecter ») en bas de la barre latérale. **Ajout hors spec** : le même bloc en bas de « Plus » sur mobile, pour qu'un téléphone puisse se déconnecter tant que Réglages n'a pas sa section Compte (ticket 20, qui pourra l'y déplacer).
- **Point de purge** : `clearDeviceData(queryClient)` (`apps/web/src/device-data.ts`) vide le cache de TanStack Query. Appelé à la déconnexion **et à la connexion** : un appareil déconnecté à distance n'a jamais pu effacer. **Ticket 13** : y ajouter le résumé persisté dans IndexedDB.
- **Tests** : `postJson` passe désormais par « Traefik » (pair de confiance et `X-Forwarded-For`), avec une IP aléatoire par requête : le limiteur par IP compte en base, que tous les tests partagent. `testApp({}, { startsAt })` règle l'horloge ; les tests de purge démarrent un an plus tôt pour ne pas effacer les lignes des autres tests. `fakeApi` accepte un POST sans corps.
- **Revue (deux axes), relevé et laissé** : `ALLOWED_NATIVE_ROUTES` n'est plus lue que par les tests (la liste blanche, ce sont les routes) ; le bouton « Afficher » de la connexion n'est pas dans la spec UX §5.9 mais dans le ticket UX 18 ; le limiteur par IP de Better Auth ne repart qu'après 15 min sans requête acceptée (plus strict que « 30 / 15 min ») ; tant que la réinitialisation n'existe pas (ticket 09), dix requêtes par quart d'heure suffisent à tenir une adresse bloquée ; le champ e-mail et le bloc mot de passe sont copiés entre connexion et inscription (à factoriser au ticket 09, troisième usage). Le test de purge des inscriptions ne lance plus que sa tâche : sept jours plus tard, il effaçait les compteurs des autres tests.
- **Laissé aux tickets suivants** : le lien « Mot de passe oublié ? » et celui du message de blocage (ticket 09) ; la détection d'un nouvel appareil (08) ; aucun parcours e2e de connexion (il faut un compte, donc le faux SMTP noté au ticket 06).
- **Vérifié à la main** sur l'API lancée en local : 401 identique, 204 et cookies effacés à la déconnexion, 404 sur `/api/auth/sign-up/email`, compteurs écrits dans `rate_limit` et `login_attempt`.

**2026-10-11, retour de Romain : les erreurs ne se voyaient pas.**

- **Décision** : le rouge est permis, **pour les erreurs seulement** (saisie, refus de l'API, panne), jamais pour un résultat. Spec UX §2 et spec stack §3 amendées, règle ajoutée au `CLAUDE.md` : elle vaut pour tous les messages d'erreur de l'app, existants et à venir.
- **Jeton `--error`** dans `packages/theme` (clair `#b91c1c`, sombre `#f87171`), contrôlé par axe dans les deux thèmes.
- **Deux composants** (`apps/web/src/components/ui/error-message.tsx`) : `ErrorMessage` (message hors champ : rouge, gras, icône, `role="alert"`, rien sans message) et `FieldErrorMessage` (erreur d'un champ). `Input` prend un contour rouge dès que son champ est invalide (`data-invalid`). Appliqués à la connexion, l'inscription, le lien invalide et la déconnexion.
- **Connexion refusée** : les deux champs prennent le contour (on ne dit jamais lequel est faux), par la classe `invalidInputClass` et non par `isInvalid`, qui ferait retenir l'essai suivant par le navigateur. Le message et le contour partent dès qu'un champ est corrigé.
