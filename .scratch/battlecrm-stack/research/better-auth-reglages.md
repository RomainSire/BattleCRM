# Better Auth — vérification des réglages (v1.7.7)

Recherche du 2026-10-07. **Version vérifiée : `better-auth@1.7.7`**, dernière 1.x (tag `v1.7.7`, commit `db02f23`, publiée sur npm le 2026-09-30 ; `npm dist-tags.latest = 1.7.7`, aucune 1.7.8/1.8 à cette date).

Sources primaires uniquement :

- Code : `https://github.com/better-auth/better-auth/blob/v1.7.7/<chemin>#L<ligne>` (abrégé ci-dessous **SRC/**`<chemin>:<ligne>`).
- Docs : `https://www.better-auth.com/docs/...` (sources MDX dans le même tag, `docs/content/docs/...`).
- Avis de sécurité : API GitHub `repos/better-auth/better-auth/security-advisories` et base globale `advisories?affects=better-auth`.

Légende : ✅ confirmé dans le code · ❌ non supporté · ⚠️ point d'attention découvert en lisant le code · 🔧 contournement (notre code, pas une fonctionnalité Better Auth).

---

## 1. Inscription avec un email déjà existant (`requireEmailVerification: true`)

✅ **Réponse neutre par défaut.** Si `emailAndPassword.requireEmailVerification === true` **ou** `emailAndPassword.autoSignIn === false`, `/sign-up/email` sur un email existant (vérifié **ou non**) renvoie **200** `{ token: null, user: <utilisateur synthétique> }`, identique en forme à une vraie inscription. Le mot de passe est quand même haché pour lisser le timing. Sinon : `422 USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`.
- SRC/packages/better-auth/src/api/routes/sign-up.ts:225-228 (`shouldReturnGenericDuplicateResponse`), :297-322 (branche « email existant »), :238-295 (`buildGenericDuplicateResponse`).
- Docs : https://www.better-auth.com/docs/authentication/email-password#require-email-verification (« signing up with an existing email returns a success response instead of an error to prevent user enumeration »).

✅ **Hook pour envoyer « vous avez déjà un compte »** : `emailAndPassword.onExistingUserSignUp({ user }, request)`. Appelé **uniquement** dans le mode neutre ci-dessus. Exécuté via `runInBackgroundOrAwait` (attendu sauf si `advanced.backgroundTasks` est configuré).
- SRC/packages/core/src/types/init-options.ts:883-895 ; sign-up.ts:308-316.
- Docs : même page, section `onExistingUserSignUp` ; https://www.better-auth.com/docs/concepts/email.

✅ `emailAndPassword.customSyntheticUser({ coreFields, additionalFields, id })` permet de forger la fausse réponse (utile si des plugins ajoutent des champs user). SRC/packages/core/src/types/init-options.ts:897-934.

✅ **Utilisateur existant non vérifié qui se ré-inscrit** : même branche que ci-dessus → **le mot de passe n'est PAS remplacé** (aucune écriture en base) et **l'email de vérification n'est PAS renvoyé** (seul `onExistingUserSignUp` est appelé). sign-up.ts:297-317 (aucun appel à `sendVerificationEmail` ni `linkAccount` dans cette branche).
- Pour renvoyer le lien : soit dans `onExistingUserSignUp` (si `!user.emailVerified`, envoyer un lien via notre code), soit `emailVerification.sendOnSignIn: true` → à la connexion d'un non-vérifié **avec le bon mot de passe**, renvoi du lien puis `403 EMAIL_NOT_VERIFIED`. SRC/packages/better-auth/src/api/routes/sign-in.ts:572-603 ; init-options.ts:752-757.

⚠️ **Fuite d'énumération possible via le format de l'`id`** quand la base génère les ids (voir §3) : l'id synthétique vaut `ctx.context.generateId({model:"user"}) || generateId()` (sign-up.ts:243-244). Avec `advanced.database.generateId: false`, `generateId` renvoie `false` → repli sur une chaîne aléatoire de 32 caractères `[a-zA-Z0-9]` (SRC/packages/core/src/utils/id.ts:3-5), alors qu'un vrai compte renvoie un UUID Postgres. 🔧 Remède : `customSyntheticUser` renvoyant un `id` au format UUIDv7 (le champ `id` de la valeur renvoyée est repris tel quel : SRC/packages/better-auth/src/db/schema.ts:105-109), ou retirer `user.id` de la réponse de `/sign-up/email` dans un `hooks.after`.

## 2. `disableSignUp: true` et `/verify-email`

✅ `emailAndPassword.disableSignUp` n'est testé **que** dans `/sign-up/email` (`400 EMAIL_PASSWORD_SIGN_UP_DISABLED`) — sign-up.ts:188-196. `/verify-email` ne le consulte pas (grep : aucune autre occurrence côté email/mot de passe). **Un utilisateur créé avant le flag peut donc toujours vérifier son email.**
- Le jeton est un JWT HS256 signé avec le secret, sans état (pas d'usage unique) ; il contient `email` (+ `updateTo`/`requestType` pour le changement d'email). Durée : `emailVerification.expiresIn`, défaut 3600 s. SRC/packages/better-auth/src/api/routes/email-verification.ts:302-322 ; init-options.ts:762-767.
- Si l'email est déjà vérifié : simple redirection/`{status:true}` sans session (email-verification.ts:481-488).

✅ **Session à la vérification** : uniquement si `emailVerification.autoSignInAfterVerification: true` (pas de défaut → désactivé). Crée alors une session complète + cookie (email-verification.ts:507-535). Hooks disponibles : `emailVerification.beforeEmailVerification(user, request)` / `afterEmailVerification(user, request)` (init-options.ts:768-785).

## 3. Ids générés par la base (UUIDv7 Postgres 18)

✅ Option : **`advanced.database.generateId`**, type `GenerateIdFn | false | "serial" | "uuid"` (SRC/packages/core/src/types/init-options.ts:445-459).
- **`false`** → Better Auth ne fournit aucun `id` à l'INSERT pour **toutes** les tables ; c'est le `DEFAULT` de la colonne qui s'applique (donc `DEFAULT uuidv7()` à déclarer nous-mêmes dans le schéma Drizzle). SRC/packages/core/src/db/adapter/get-id-field.ts:37-49 et :59-63 ; SRC/packages/better-auth/src/context/create-context.ts:250-266.
- **Fonction** `({ model, size }) => string | false | undefined` : renvoyer `false`/`undefined` pour un modèle laisse la base générer pour ce modèle seulement. Docs : https://www.better-auth.com/docs/concepts/database (section ID generation, « Returning `false` or `undefined` from the `generateId` function lets the database handle ID generation for that specific model »).
- **`"uuid"`** sur Postgres : Better Auth ne génère pas en JS (`supportsUUIDs: true` pour `provider: "pg"`, SRC/packages/drizzle-adapter/src/drizzle-adapter.ts:1233 ; get-id-field.ts:43-45) et le schéma généré par la CLI utilise `gen_random_uuid()` (**v4**, d'après le commentaire init-options.ts:452-456). Pour du **v7**, utiliser `false` + `DEFAULT uuidv7()` dans notre schéma.

✅ **Relecture des ids** : l'adaptateur Drizzle fait `INSERT … RETURNING` (tous fournisseurs sauf MySQL) et renvoie la ligne créée — l'id généré par la base est donc bien relu. drizzle-adapter.ts:229-238 (`withReturning`), :792-800 (`create`).

⚠️ Avec `generateId: false`, les ids « hors base » retombent sur l'id aléatoire 32 caractères : id synthétique de §1, et id de session **seulement** si les sessions vivent uniquement en `secondaryStorage` (SRC/packages/better-auth/src/db/internal-adapter.ts:489-494). Sans secondary storage, rien à signaler.

## 4. Rate limiting

✅ Options (`rateLimit`, SRC/packages/core/src/types/init-options.ts:253-292 ; défauts create-context.ts:357-365) :
- `enabled` — défaut : **activé seulement en production** (`isProduction`).
- `window` défaut **10 s**, `max` défaut **100**.
- `storage: "memory" | "database" | "secondary-storage"` — défaut `"secondary-storage"` si `secondaryStorage` est configuré, sinon `"memory"`. `"database"` utilise la table `rateLimit` (incréments atomiques conditionnels). `"secondary-storage"` exige `secondaryStorage.increment`. `customStorage` (objet `{ consume(key, rule) }`) remplace tout.
- `customRules: { [chemin|glob]: { window, max } | false | (request, currentRule) => règle|false }`.
- Code : SRC/packages/better-auth/src/api/rate-limiter/index.ts (stockages :287-347, résolution :358-433).

✅ **Clé = IP + chemin** : `` `${ip}|${path}` `` (SRC/packages/core/src/utils/ip.ts:395-399). Si aucune IP fiable n'est trouvée → **un seau partagé par chemin** (`"no-trusted-ip"|path`, fail-closed) + avertissement dans les logs (rate-limiter/index.ts:358-382).

✅ **Règles spéciales intégrées** (rate-limiter/index.ts:435-469) : `/sign-in*`, `/sign-up*`, `/change-password*`, `/change-email*` → **3 req / 10 s** ; `/request-password-reset`, `/send-verification-email`, `/forget-password*`, `/email-otp/…` → **3 req / 60 s**. Plugin 2FA : `/two-factor/*` → 3 / 10 s (SRC/packages/better-auth/src/plugins/two-factor/index.ts:606-614). Priorité : règle spéciale < règle de plugin < `customRules`.

✅ **IP derrière un reverse proxy** (`advanced.ipAddress`, init-options.ts:299-341 ; logique ip.ts:287-388) :
- `ipAddressHeaders` — défaut `["x-forwarded-for"]`, parcourus dans l'ordre.
- `trustedProxies` (IP ou CIDR) — si défini, la chaîne `X-Forwarded-For` est lue **de droite à gauche** en sautant les proxys de confiance ; la première IP non fiable est le client.
- **Sans `trustedProxies`, seul un en-tête à valeur unique est accepté** : une chaîne `a, b` → `null` → seau partagé.
- `ipv6Subnet` défaut **/64** (regroupement IPv6). `disableIpTracking` désactive le rate limit par IP (déconseillé).
- Better Auth **ne lit pas l'adresse socket** : uniquement les en-têtes (en dev/test, repli sur `127.0.0.1`). Il faut donc que le proxy écrase/positionne l'en-tête et que l'app ne soit pas joignable sans le proxy.

❌ **Aucun verrouillage / throttling par compte (par email) sur `/sign-in/email`.** La clé est toujours IP|chemin ; `customRules` et `customStorage` ne reçoivent que la `Request`/la clé déjà calculée et ne changent que `window`/`max`. (Le seul verrouillage par compte existant concerne le **second facteur** du plugin 2FA, voir §6.)

✅ **Point d'accroche recommandé pour un throttling par compte** :
- `hooks.before: createAuthMiddleware(async ctx => { if (ctx.path === "/sign-in/email") … ctx.body.email … throw new APIError("TOO_MANY_REQUESTS") })` — docs https://www.better-auth.com/docs/concepts/hooks.
- `hooks.after` **voit le résultat** : `ctx.context.returned` contient la valeur renvoyée **ou l'`APIError`** (les erreurs de l'endpoint sont capturées puis passées aux after-hooks), et `ctx.context.newSession` la session créée. SRC/packages/better-auth/src/api/dispatch.ts:399-433 (capture de l'APIError puis `runAfterHooks`), :225-266. Docs hooks : « `ctx.context.returned` … could be a successful response or an APIError ».
- ⚠️ Ordre : le hook utilisateur `hooks.after` s'exécute **avant** les after-hooks des plugins (dispatch.ts:268-304). Sur `/sign-in/email` avec 2FA actif, il voit donc la session provisoire (voir §6) : tester `newSession.user.twoFactorEnabled`.

ℹ️ L'avis GHSA-44jh-23m7-hpcf (corrigé en 1.7.7) concernait justement des requêtes concurrentes qui dépassaient la limite avec l'adaptateur Drizzle/PostgreSQL en stockage `database`.

## 5. Sessions

✅ Options `session` (SRC/packages/core/src/types/init-options.ts:1050-1188 ; défauts create-context.ts:312-321) :
- `expiresIn` défaut **7 jours** ; `updateAge` défaut **1 jour** — glissement : si `expiresAt − expiresIn + updateAge ≤ maintenant`, `expiresAt` est repoussé à `maintenant + expiresIn` et `updatedAt` mis à jour (SRC/packages/better-auth/src/api/routes/session.ts:324-372). `updateAge: 0` → rafraîchi à chaque usage. `disableSessionRefresh`, `deferSessionRefresh` disponibles.
- `rememberMe: false` à la connexion → session de **1 jour** (internal-adapter.ts:503-510).
- `cookieCache: { enabled (défaut false), maxAge (défaut 300 s), strategy "compact"|"jwt"|"jwe" (défaut "compact"), refreshCache, version }`.
- `freshAge` défaut **1 jour**, mesuré depuis **`session.createdAt`** (pas `updatedAt`) ; `0` désactive. Il gate exactement (middleware `freshSessionMiddleware`, session.ts:597-618) : **`GET /list-sessions`** (session.ts:620-626), **`POST /unlink-account`** (account.ts:455-462), **`/delete-user` sans mot de passe** (update-user.ts:525-531, renvoie `SESSION_EXPIRED`), et les endpoints passkey avec session. Il ne gate **pas** `/change-password`, `/change-email`, ni les endpoints 2FA (ceux-là utilisent `sessionMiddleware` ou `sensitiveSessionMiddleware`, ce dernier forçant la lecture en base au lieu du cookie cache, session.ts:561-576).

✅ Colonnes de la table session : `id, createdAt, updatedAt, userId, expiresAt, token, ipAddress, userAgent` (SRC/packages/core/src/db/schema/session.ts:9-15 ; shared.ts). `ipAddress` = `getIP()` (même logique que §4, `""` si inconnue) et `userAgent` = en-tête `user-agent`, renseignés **à la création** uniquement (internal-adapter.ts:499-503) ; le rafraîchissement ne les met pas à jour (session.ts:366-372). ⚠️ Le `token` est stocké en clair dans la colonne `token`.

✅ Endpoints (session.ts) : `GET /list-sessions` (`listSessions`, fresh requis), `POST /revoke-session` `{ token }` (:676), `POST /revoke-sessions` (toutes, :757), `POST /revoke-other-sessions` (:812) — les trois derniers via `sensitiveSessionMiddleware`. Docs : https://www.better-auth.com/docs/concepts/session-management.

✅ `emailAndPassword.revokeSessionsOnPasswordReset` (défaut `false`) → `/reset-password` supprime **toutes** les sessions de l'utilisateur (SRC/packages/better-auth/src/api/routes/password.ts:325-327 ; init-options.ts:877-881).
✅ `POST /change-password { newPassword, currentPassword, revokeOtherSessions? }` → si `revokeOtherSessions: true`, supprime toutes les sessions puis en crée une nouvelle pour la requête courante (SRC/packages/better-auth/src/api/routes/update-user.ts:151-310, extrait :283-300).

## 6. Plugin `twoFactor`

✅ **TOTP + codes de secours** (SRC/packages/better-auth/src/plugins/two-factor/) :
- Codes de secours : **10 codes de 10 caractères** par défaut (`backupCodeOptions.amount`/`length`), stockés **chiffrés** par défaut (`storeBackupCodes: "encrypted"`). backup-codes/index.ts:28-38, :64-69 ; index.ts:54-57.
- Régénération : **`POST /two-factor/generate-backup-codes`** (backup-codes/index.ts:434-439).
- ❌ **Pas d'endpoint HTTP donnant le nombre restant.** Seul `auth.api.viewBackupCodes({ body: { userId } })` existe, **server-only**, renvoyant les codes déchiffrés (→ on peut en calculer la longueur côté serveur). backup-codes/index.ts:552-589.
- Autres endpoints : `/two-factor/enable`, `/two-factor/disable`, `/two-factor/get-totp-uri`, `/two-factor/verify-totp`, `/two-factor/verify-backup-code`, `/two-factor/send-otp`/`verify-otp` (OTP email/SMS). `generateTOTP` est server-only.

✅ **Mot de passe requis** (sauf `allowPasswordless: true` **et** aucun compte credential, SRC/packages/better-auth/src/utils/password.ts:70-83) pour : **enable** (index.ts:170-195), **disable** (:350-375), **generate-backup-codes** (backup-codes/index.ts:485-494), **get-totp-uri** (totp/index.ts:207-216). Pour nous (compte email+mot de passe) : toujours requis.

✅ **`trustDevice`** : paramètre **côté client** (`trustDevice: true` dans le corps de `verify-totp` / `verify-backup-code` / `verify-otp`), cookie signé `trust_device` + ligne `verification`, durée `trustDeviceMaxAge` défaut **30 jours**, renouvelé à chaque connexion. constant.ts ; index.ts:450-521 ; verify-two-factor.ts:99-130.
- ❌ **Aucune option serveur pour le désactiver.** 🔧 Contournement : `hooks.before` qui rejette (ou ignore) `ctx.body.trustDevice` sur les chemins `/two-factor/verify-*`.

✅ **Verrouillage du second facteur** (intégré, par compte) : `accountLockout: { enabled (défaut true), maxFailedAttempts (défaut 10), durationSeconds (défaut 900) }`, et 5 essais max par challenge. types.ts ; constant.ts.

❌ **`/reset-password` ne vérifie pas la 2FA** : il consomme le jeton, change le mot de passe, appelle `onPasswordReset`, éventuellement révoque les sessions — aucune référence au plugin 2FA (password.ts:233-334 ; le plugin ne déclare aucun hook sur ce chemin). Il **ne crée pas de session** : la connexion suivante passera toujours par la 2FA.
- 🔧 Point d'accroche si on veut exiger un TOTP/code de secours au reset : `hooks.before` sur `ctx.path === "/reset-password"` → retrouver l'utilisateur via `ctx.context.internalAdapter.findVerificationValue("reset-password:" + token)` (identifiant utilisé en password.ts:288), puis vérifier le code nous-mêmes (secret TOTP chiffré dans la table `twoFactor`). Better Auth n'expose **pas** d'API serveur « vérifier un TOTP pour un userId » hors du flux cookie/session (verify-totp exige une session ou le cookie `two_factor`) — c'est donc du code maison, non vérifié ici.

✅ **Flux de session avec 2FA** : `/sign-in/email` crée d'abord une **vraie session en base** (et pose le cookie), puis l'after-hook du plugin (si `user.twoFactorEnabled` et pas d'appareil de confiance valide) **supprime cette session et le cookie**, met `newSession` à `null`, crée un challenge (`verification` `2fa-…`, cookie signé **`two_factor`**, défaut 10 min `twoFactorCookieMaxAge`) et renvoie `{ twoFactorRedirect: true, twoFactorMethods }`. La session définitive n'est créée qu'après `verify-totp`/`verify-backup-code` réussi (challenge consommé atomiquement). index.ts:431-603 ; verify-two-factor.ts:22-98.
- ⚠️ Conséquence : `databaseHooks.session.create.after` **se déclenche aussi pour la session provisoire** (mot de passe correct, 2FA pas encore passée) — voir §10.
- ⚠️ `enable` (méthode otp / `skipVerificationOnEnable`) et `disable` **remplacent la session courante** par une nouvelle (index.ts:210-230, :391-406).

## 7. Changement d'email (`user.changeEmail`)

✅ `POST /change-email { newEmail, callbackURL? }` (`sensitiveSessionMiddleware`), nécessite `user.changeEmail.enabled: true` (SRC/packages/better-auth/src/api/routes/update-user.ts:654-880 ; options init-options.ts:980-1005). Docs : https://www.better-auth.com/docs/concepts/users-accounts#change-email.
- **Par défaut (utilisateur vérifié, pas de `sendChangeEmailConfirmation`)** : lien envoyé à la **NOUVELLE adresse** via `emailVerification.sendVerificationEmail` (avec `user.email = newEmail`) ; l'email n'est modifié qu'au clic (`emailVerified: true`). update-user.ts:855-880 ; email-verification.ts:370-417.
- **Avec `user.changeEmail.sendChangeEmailConfirmation({ user, newEmail, url, token }, request)`** : lien envoyé d'abord à l'**ANCIENNE** adresse ; au clic, envoi du lien de vérification à la nouvelle (deux étapes). update-user.ts:817-846 ; email-verification.ts:339-367.
- `updateEmailWithoutVerification` (défaut `false`) : mise à jour immédiate seulement si l'email actuel n'est pas vérifié.
- Si `newEmail` appartient déjà à un compte : réponse `{ status: true }` silencieuse (update-user.ts:751-765).

❌ **Pas d'option « envoyer à la nouvelle + simple notification à l'ancienne ».** 🔧 Faisable avec le mode par défaut + `hooks.after` sur `ctx.path === "/change-email"` (l'ancienne adresse est `ctx.context.session.user.email`) pour notifier la demande, et/ou `emailVerification.afterEmailVerification` (reçoit l'utilisateur mis à jour, donc la nouvelle adresse seulement).

⚠️ Au clic sur le lien `change-email-verification` **sans session active**, Better Auth **crée une session** pour l'utilisateur et pose le cookie (email-verification.ts:370-385, idem en flux legacy :421-436), **sans passer par la 2FA**. Le lien vaut donc connexion pour qui contrôle la nouvelle boîte, jusqu'à expiration du JWT (défaut 1 h, non à usage unique).

## 8. Plugin Have I Been Pwned

✅ Nom : `haveIBeenPwned(options)` (id `"have-i-been-pwned"`), SRC/packages/better-auth/src/plugins/haveibeenpwned/index.ts. Docs : https://www.better-auth.com/docs/plugins/have-i-been-pwned.
- **k-anonymat** : SHA-1 du mot de passe, seuls les **5 premiers caractères** sont envoyés à `https://api.pwnedpasswords.com/range/<préfixe>` avec l'en-tête `Add-Padding: true` ; comparaison du suffixe en local (index.ts:51-84).
- Mécanisme : enveloppe `ctx.password.hash` ; ne contrôle que si le chemin courant est dans `paths`. Défaut : `/sign-up/email`, `/change-password`, `/reset-password`, `/email-otp/reset-password`, `/phone-number/reset-password`, `/admin/create-user`, `/admin/set-user-password` (index.ts:117-149). Options : `paths`, `customPasswordCompromisedMessage`, `enabled`.
- Mot de passe compromis → `400 PASSWORD_COMPROMISED`.
- **API injoignable → fail-closed** : `500 INTERNAL_SERVER_ERROR` (« Failed to check password… »), l'opération est refusée (index.ts:69-82). Aucun timeout ni mode « fail-open » configurable n'apparaît dans le code.
- Note : le hachage « factice » de l'inscription sur email existant (§1) passe aussi par ce contrôle → comportement identique email existant / nouveau, y compris en cas de panne HIBP.

## 9. Plugin `bearer` et contrôles d'origine / CSRF

✅ **Bearer** (SRC/packages/better-auth/src/plugins/bearer/index.ts) : before-hook qui lit `Authorization: Bearer <token>`, vérifie la signature HMAC, puis **injecte le token comme cookie de session** dans les en-têtes de la requête (:47-116). After-hook : si la réponse pose un cookie de session, renvoie sa valeur dans l'en-tête **`set-auth-token`** et l'ajoute à `Access-Control-Expose-Headers` (:119-157) → oui, renvoyé au sign-in (et à toute réponse qui pose le cookie). `requireSignature` (option) refuse les tokens non signés. Docs : https://www.better-auth.com/docs/plugins/bearer.
- ✅ La session est une **ligne normale** de la table `session` (le bearer n'est que le token de session signé) → listable/révocable comme les autres.
- ⚠️ Le bearer ne transporte **que** le cookie de session : le challenge 2FA repose sur le cookie signé `two_factor` (verify-two-factor.ts:28-38), que ce plugin ne gère pas. Un client sans cookies ne peut pas finir une connexion 2FA par ce seul mécanisme (non testé ; constat de lecture du code).

✅ **Contrôle d'origine** (SRC/packages/better-auth/src/api/middlewares/origin-check.ts ; monté sur `/**`, SRC/packages/better-auth/src/api/index.ts:288-293) :
- Ignoré pour GET/HEAD/OPTIONS.
- `validateOrigin` n'est appliqué **que si la requête porte un en-tête `Cookie`** (:229-251). Une requête Bearer **sans cookie** n'est donc pas soumise au contrôle d'origine sur les endpoints ordinaires (les `callbackURL`/`redirectTo` restent validés, :147-150).
- **Exception : `/sign-in/email` et `/sign-up/email`** (`formCsrfMiddleware`, sign-in.ts:408, sign-up.ts:38) : même sans cookie, si la requête porte des en-têtes Fetch Metadata (`Sec-Fetch-*`) ou un `Origin`/`Referer`, l'origine **doit** être de confiance ; navigation cross-site bloquée (:316-375).
- `trustedOrigins: string[] | (request) => (string|null|undefined)[]` (init-options.ts:1404-1411). Les schémas non-http sont gérés (trusted-origins.ts:138-163) : `moz-extension://<uuid>` correspond **exactement** à cette autorité ; un motif **sans hôte** `moz-extension://` fait confiance à **toutes** les extensions de ce schéma. La doc cite l'exemple `chrome-extension://YOUR_EXTENSION_ID` (https://www.better-auth.com/docs/reference/security). Comme l'UUID `moz-extension` est propre à chaque installation (donnée de l'énoncé), la liste statique n'est pas praticable : choisir entre la forme fonction de `trustedOrigins` ou le motif sans hôte (qui accepte toute extension Firefox) — arbitrage à faire de notre côté.

## 10. Hooks pour effets de bord (emails de sécurité)

✅ `databaseHooks.session.create.after(session, context)` : reçoit la **ligne créée** (avec `userId`, `ipAddress`, `userAgent`, `createdAt`…) et le `GenericEndpointContext | null` (donc `context.path`, `context.request`). Exécuté **après la transaction** (`queueAfterTransactionHook`). SRC/packages/better-auth/src/db/with-hooks.ts:30-98 ; signatures init-options.ts:1426+. Docs : https://www.better-auth.com/docs/concepts/database#database-hooks.
- ⚠️ Se déclenche pour **toute** création de session : connexion **y compris la session provisoire pré-2FA** (§6), `verify-totp`/`verify-backup-code`, auto-sign-in après inscription ou vérification, clic de changement d'email, rotation par `two-factor/enable|disable`, `change-password` avec `revokeOtherSessions`. 🔧 Pour un email « nouvel appareil », filtrer sur `context.path` (ex. ignorer `/sign-in/email` quand `user.twoFactorEnabled`, traiter `/two-factor/verify-*`) ou passer par `hooks.after` sur `/sign-in/email` + `/two-factor/verify-*` avec `ctx.context.newSession`.

✅ Emails de sécurité :
- **Reset du mot de passe** : callback dédié `emailAndPassword.onPasswordReset({ user }, request)` (password.ts:316-323 ; init-options.ts:848-858).
- **Changement de mot de passe** : ❌ pas de callback dédié (aucun `onPasswordChange` dans le code). 🔧 `hooks.after` sur `ctx.path === "/change-password"` en vérifiant que `ctx.context.returned` n'est pas une `APIError`.
- **2FA activée/désactivée** : ❌ pas de callback dédié. 🔧 `hooks.after` sur `/two-factor/disable` (désactivation effective) ; pour l'activation TOTP, `twoFactorEnabled: true` n'est posé qu'au **premier `verify-totp` réussi** (totp/index.ts:326-358), pas à `/two-factor/enable` → accrocher sur `/two-factor/verify-totp` ou `databaseHooks.user.update.before/after` (le `before` reçoit les champs modifiés, ex. `{ twoFactorEnabled: true }`).

## 11. Règles de mot de passe

✅ `emailAndPassword.minPasswordLength` défaut **8**, `maxPasswordLength` défaut **128** (create-context.ts:375-376 ; init-options.ts:814-824), comparés à `password.length` (unités UTF-16) dans SRC/packages/better-auth/src/utils/password.ts:8-24.

✅ Hachage par défaut : **scrypt** (`node:crypto` sous Node), paramètres dans `@better-auth/utils@0.4.2` (version épinglée dans `pnpm-workspace.yaml:67` du tag) : **N=16384, r=16, p=1, dkLen=64**, sel aléatoire 16 octets, mot de passe normalisé NFKC, format `sel:hash` (hex). Source : `dist/password.node.mjs` du paquet npm `@better-auth/utils@0.4.2` (dépôt github.com/better-auth/utils) ; SRC/packages/better-auth/src/crypto/password.ts:1-13.

✅ Argon2 : `emailAndPassword.password: { hash(password), verify({ hash, password }) }` (init-options.ts:859-870). La doc donne l'exemple `@node-rs/argon2` (Argon2id, 64 MiB, t=3, p=4) : https://www.better-auth.com/docs/authentication/email-password (section Password Hashing).

## 12. Avis de sécurité (GHSA) — situation au 2026-10-07

**Aucun avis publié après la sortie de 1.7.7 n'affecte 1.7.7**, d'après l'API des avis du dépôt et la base globale (`advisories?ecosystem=npm&affects=better-auth@1.7.7` → vide). Réserve : les avis non encore publiés sont invisibles.

Exception à connaître : **GHSA-fmh4-wcc4-5jm3** (high, plugin `organization`) — l'avis du dépôt indique « vulnérable `>= 1.6.14`, pas de version corrigée » : il faut une configuration (`requireEmailVerificationOnInvitation: true` ou `requireEmailVerification: true`). Sans objet si on n'utilise pas `organization`, et notre `requireEmailVerification: true` fait partie des remèdes cités.

Avis 2026 touchant `better-auth` (cœur) et `@better-auth/drizzle-adapter` :

| GHSA | Sévérité | Sujet | Corrigé en |
|---|---|---|---|
| GHSA-44jh-23m7-hpcf | low | Requêtes concurrentes dépassant le rate limit (Drizzle/PostgreSQL) | 1.7.7 |
| GHSA-965c-763c-88jm | critical | State OAuth utilisable comme magic link | 1.7.7 |
| GHSA-r4xp-prcw-77qf | high | Plugin OAuth Proxy : connexion en tant qu'un autre | 1.7.7 |
| GHSA-q84f-53jg-9ppm | high | Device authorization : approbation sans afficher client/permissions | 1.7.0-rc.3 |
| GHSA-qq9h-g4jm-xgf3 | high | Mot de passe d'un attaquant toujours valide après magic link / email OTP | 1.6.22 / 1.7.0-beta.10 |
| GHSA-fmh4-wcc4-5jm3 | high | Organisation : invitation acceptée par un compte non vérifié | 1.6.11 ; ≥1.6.14 : config requise |
| GHSA-g38m-r43w-p2q7 | high | Liaison OAuth à un compte pré-enregistré non vérifié | 1.6.11 / 1.7.0-beta.4 |
| GHSA-cq3f-vc6p-68fh | high | Device authorization : n'importe quelle session approuve | 1.6.11 |
| GHSA-9h47-pqcx-hjr4 | high | oidcProvider : PKCE plain / alg none | 1.6.11 |
| GHSA-86j7-9j95-vpqj | medium (base globale : high) | oidc/mcp : `javascript:` redirect URI | 1.6.13 / 1.7.0-beta.4 |
| GHSA-pw9m-5jxm-xr6h | medium (base globale : critical) | oidc/mcp : refresh token sans secret client | 1.6.11 |
| GHSA-2vg6-77g8-24mp | low | Sessions persistantes après suppression (secondary storage) | 1.6.11 |
| GHSA-p6v2-xcpg-h6xw | high | Contournement du rate limit par rotation IPv6 | 1.4.17 / 1.5.0-beta.9 |
| GHSA-wxw3-q3m9-c3jr | medium | State OAuth forgé (stockage cookie sans PKCE) | 1.6.2 |
| GHSA-xg6x-h9c9-2m83 | high (base globale : critical) | Contournement 2FA via `cookieCache` | 1.4.6 |
| GHSA-392p-2q2v-4372 | high | Rotation refresh token (oauth-provider ; `better-auth` < 1.6.0) | 1.6.0 / 1.6.11 |

Autres paquets non utilisés a priori (sso, scim, stripe, oauth-provider) : GHSA-mx9r-x6ww-qjw9, GHSA-8c5h-wx78-2cfg, GHSA-prpr-5gj3-qqhg, GHSA-h3rm-78g3-j7cp, GHSA-rjg6-39jm-rgg4, GHSA-j8v8-g9cx-5qf4, GHSA-p2fr-6hmx-4528, GHSA-gv74-j8m3-fg5f, GHSA-7w99-5wm4-3g79, GHSA-5rr4-8452-hf4v, GHSA-xr8f-h2gw-9xh6 — tous corrigés en ≤ 1.7.3.

Sources : https://github.com/better-auth/better-auth/security/advisories ; https://github.com/advisories?query=better-auth.
