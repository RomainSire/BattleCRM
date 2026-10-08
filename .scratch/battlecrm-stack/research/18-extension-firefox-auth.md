# Extension Firefox → API BattleCRM : CORS, cookies, Better Auth, distribution

Recherche du 2026-10-08 pour le ticket 18. Versions lues : **Firefox `main` @ `098e537c`** (2026-10-08) et **`better-auth@1.7.7`** (même version que `better-auth-reglages.md`).

Abréviations : **FF/**`<chemin>:<ligne>` = `https://github.com/mozilla-firefox/firefox/blob/098e537cc4338b343383540dd7e7907fece986b7/<chemin>#L<ligne>` ; **BA/**`<chemin>:<ligne>` = `https://github.com/better-auth/better-auth/blob/v1.7.7/<chemin>#L<ligne>`.

Légende : ✅ fait documenté ou lu dans le code · 🔎 déduction tirée du code, pas testée dans un navigateur · ⚠️ point d'attention.

Hypothèse : le `fetch` part d'une **page d'extension** (background/event page, popup, page d'options), **pas d'un content script**, vers `https://app.battlecrm.romainsire.com/*`, déclaré dans `host_permissions` (MV3) ou `permissions` (MV2), et l'utilisateur a bien accordé cette permission.

---

## 1. CORS, en-tête `Origin`, UUID `moz-extension`

✅ **CORS contourné** pour les origines déclarées en host permission : « XMLHttpRequest and fetch access to those origins without cross-origin restrictions, but not for requests from content scripts ». https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions
- 🔎 Mécanisme : `ContentPrincipal::MayLoadInternal` accepte l'URI si `AddonAllowsLoad(uri)` est vrai (FF/caps/ContentPrincipal.cpp:282-286). `nsCORSListenerProxy` considère alors la requête comme « même origine » et ne fait **ni CORS ni preflight** (FF/netwerk/protocol/http/nsCORSListenerProxy.cpp:1165-1170).

🔎 **En-tête `Origin` envoyé** (FF/netwerk/protocol/http/nsHttpChannel.cpp:11973-12090, implémentation de https://fetch.spec.whatwg.org/#append-a-request-origin-header) :
- La requête n'est pas « CORS-tainted ». Firefox applique donc la règle « même origine » de la spec : **`Origin` est envoyé seulement si la méthode n'est ni GET ni HEAD**.
- **POST/PUT/PATCH/DELETE → `Origin: moz-extension://<uuid>`**. `moz-extension` est explicitement autorisé comme origine sérialisable pour une requête d'extension (`HasNullRequestOrigin`, nsHttpChannel.cpp:11944-11957).
- **GET/HEAD → pas d'`Origin`**. Constat cohérent avec un témoignage utilisateur (« only in POST ») dans https://bugzilla.mozilla.org/show_bug.cgi?id=1405971#c46.
- Historique : une tentative de remplacer l'origine par `null` (Fx 73) a été annulée (https://bugzilla.mozilla.org/show_bug.cgi?id=1607154). Le bug 1405971 (fuite de l'UUID) est toujours **NEW, non assigné**. ⚠️ Une évolution future reste possible, mais rien n'est prévu.
- ✅ `Sec-Fetch-Site: same-origin` est envoyé pour une requête d'extension autorisée par host permission (FF/dom/security/SecFetch.cpp:155-163).

✅ **UUID aléatoire par profil, stable dans le temps.** Firefox associe *ID de l'add-on → UUID* dans la préférence `extensions.webextensions.uuids`. L'UUID est généré à la première installation, conservé ensuite (« should not change once assigned ») et supprimé à la désinstallation (FF/toolkit/components/extensions/Extension.sys.mjs:343-405, :653). MDN : « randomly generated for every browser instance » (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/web_accessible_resources) ; « changes for every instance of Firefox » (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities).
- ✅ **`browser_specific_settings.gecko.id` ne fixe pas l'UUID.** Il sert seulement de **clé** dans cette table. L'UUID diffère donc d'un collègue à l'autre et change après une réinstallation. **Impossible de l'écrire en dur côté serveur.**

## 2. Cookies de session (`credentials`, `SameSite=Lax`, `__Secure-`, partitionnement)

🔎 **Les cookies du site sont envoyés, même sans `credentials: 'include'`.** Avec le mode par défaut `same-origin`, Firefox ne rend la requête anonyme que si `loadingPrincipal->CheckMayLoad(uri)` échoue (FF/dom/security/nsContentSecurityManager.cpp:1578-1590). Or ce test réussit grâce à la host permission (voir §1). Mettre `credentials: 'include'` reste plus explicite et donne le même résultat ; `'omit'` coupe les cookies.

🔎 **`SameSite=Lax` (et `Strict`) envoyés.** `CookieCommons::IsSameSiteForeign` renvoie `false` (« Do not treat loads triggered by web extensions as foreign ») quand le principal déclencheur est une extension et que `AddonAllowsLoad(uri)` est vrai (FF/netwerk/cookie/CookieCommons.cpp:612-638).
- ✅ Origine du comportement : https://bugzilla.mozilla.org/show_bug.cgi?id=1629436 (Fx 77, « requests with webExtension loading principal are not 3rd party »). Rob Wu y écrit : « requests from extensions are considered to be first-party if the extension has the right permission » (c16).

🔎 **Préfixes `__Secure-` / `__Host-`** : ils ne contraignent que le **dépôt** du cookie (HTTPS, `Path=/`, pas de `Domain` pour `__Host-`). L'envoi vers `https://app…` suit les règles ordinaires. Aucun traitement spécifique aux extensions n'apparaît dans le code.

🔎 **Total Cookie Protection et partitionnement : pas d'effet.** Les principaux d'extension reçoivent toujours `BEHAVIOR_ACCEPT` (« WebExtensions principals always get BEHAVIOR_ACCEPT », FF/toolkit/components/antitracking/StorageAccess.cpp:422-445). Côté réception, `isForeignAndNotAddon` reste faux quand l'extension a la permission, donc un `Set-Cookie` **n'est pas partitionné** (FF/netwerk/cookie/CookieService.cpp:545-572).
- **Les `Set-Cookie` des réponses sont donc enregistrés dans le pot de cookies normal du site.** Un login ou une rotation de session faits depuis l'extension s'appliquent aussi aux onglets.

⚠️ **Limites (déductions, non testées)** : l'extension utilise le magasin de cookies par défaut (`userContextId 0`, hors navigation privée). Une session ouverte **uniquement** dans un onglet conteneur ou une fenêtre privée ne sera pas vue.

**MV2 / MV3** : le code ci-dessus dépend seulement du principal et de `AddonAllowsLoad`, pas de la version du manifeste. La vraie différence concerne **l'octroi de la permission** :
- ✅ MV2 : la permission est accordée à l'installation.
- ✅ MV3 : elle est affichée dans l'invite d'installation depuis **Fx 127**, mais reste **révocable** à tout moment dans about:addons (https://blog.mozilla.org/addons/2024/05/14/manifest-v3-updates/). Il faut vérifier avec `permissions.contains`, puis appeler `permissions.request` si besoin (page MDN host_permissions).
- ⚠️ Nouvelles host permissions ajoutées par une mise à jour MV3 : **non affichées** (bug 1893232, cité par MDN).

**Stabilité** : ✅ le contournement CORS est documenté par MDN. 🔎 L'envoi des cookies `Lax` et l'absence de partitionnement sont **voulus** (bug 1629436, commentaires explicites dans le code), mais **ne sont pas documentés sur MDN**. Zone grise modérée : c'est stable depuis Fx 77, sans engagement public.

## 3. Better Auth 1.7.7

✅ **Les jokers sont acceptés dans `trustedOrigins`.** `matchesOriginPattern` (BA/packages/better-auth/src/auth/trusted-origins.ts:116-165) gère :
- les jokers (`*`, `**`, `?`) ;
- les schémas personnalisés sans hôte (`"myapp://"`), qui font confiance à **tout** hôte du schéma.

Docs : https://www.better-auth.com/docs/reference/security#custom-schemes (exemple `chrome-extension://…`) ; guide extension, qui met en garde contre `chrome-extension://*` (« trusting all extensions ») : https://www.better-auth.com/docs/guides/browser-extension-guide.

Résultats testés avec `better-auth@1.7.7` installé, pour une origine `moz-extension://<uuid>` :
- `"moz-extension://*"` → ✅ correspond à l'origine nue, ❌ pas à `…/popup.html`. Le `Referer` porte un chemin, donc il échouerait si `Origin` manquait.
- `"moz-extension://"` → ✅ correspond aux deux (tout UUID, tout chemin).
- `"moz-extension://<uuid précis>"` → ✅, mais inutilisable puisque l'UUID varie (§1).
- Alternative : `trustedOrigins: async (request) => [...]`, liste dynamique par requête (docs : même page, « Dynamic origin list »).

✅ **Vérification de l'origine** (BA/packages/better-auth/src/api/middlewares/origin-check.ts) :
- `originCheckMiddleware` **ignore GET/HEAD/OPTIONS** (:67-77).
- `validateOrigin` **ne vérifie que si la requête porte un en-tête `Cookie`** (:229-251). Il lit `Origin`, sinon `Referer`. Il renvoie 403 `MISSING_OR_NULL_ORIGIN` si les deux sont absents, et 403 `INVALID_ORIGIN` si l'origine n'est pas de confiance (:271-296).
- **Sans cookie** (bearer pur), la vérification d'origine est sautée.
- Exception : `/sign-in/email`, `/sign-up/email`, magic-link et email-otp passent par `formCsrfMiddleware` (:316-375). Celui-ci valide **toujours** l'origine si `Sec-Fetch-*` est présent, ou si `Origin`/`Referer` l'est. Firefox envoie les deux sur un POST d'extension (§1). **Un login lancé depuis l'extension exige donc `moz-extension://` dans `trustedOrigins`, même en bearer.**
- ⚠️ Ces middlewares ne protègent **que les routes Better Auth** (`/api/auth/*`). Les routes Hono métier ont leur propre protection CSRF, si elle existe, et doivent aussi accepter `moz-extension://…` sur les POST qui portent le cookie.

✅ **Plugin `bearer`** (BA/packages/better-auth/src/plugins/bearer/index.ts:42-160 ; docs https://www.better-auth.com/docs/plugins/bearer) :
- **Émission** : un hook `after` sur toute réponse qui pose le cookie de session copie **la valeur du cookie** (jeton signé `token.signature`) dans l'en-tête `set-auth-token`. Il ajoute aussi cet en-tête à `Access-Control-Expose-Headers` (:119-156).
- **Lecture** : un hook `before` lit `Authorization: Bearer <x>` et vérifie le HMAC avec le secret. Un jeton non signé est signé à la volée, sauf si `requireSignature: true`. Le hook **réécrit l'en-tête `Cookie`** interne avec ce jeton (:47-116). Le jeton est donc **exactement la même ligne `session`** que la session cookie : même expiration, même `updateAge`. Il est **révoqué** par `revokeSession(s)`, `signOut` ou la suppression de la ligne.
- `listSessions` renvoie toutes les sessions actives de l'utilisateur, quel que soit le transport (BA/packages/better-auth/src/api/routes/session.ts:652-655). Une session ouverte via l'extension y apparaît comme une autre (`userAgent` Firefox).
- 🔎 Le hook `before` lit la requête d'origine, mais `validateOrigin` lit `ctx.request.headers` **d'origine**, donc sans `Cookie`. Une requête bearer pure (`credentials: 'omit'`) n'est donc pas soumise à la vérification d'origine.
- Pour les routes Hono, `auth.api.getSession({ headers })` accepte l'en-tête `Authorization`, comme le montre la doc bearer.

## 4. Distribution pour un petit cercle

✅ **Signature obligatoire** sur Firefox release/beta. Developer Edition, Nightly et ESR peuvent désactiver `xpinstall.signatures.required`.
- Mode **« On your own » (non listé)** : validation automatique, puis signature, « up to 24 hours », typiquement quelques minutes.
- L'extension reste soumise à une revue manuelle **à tout moment** après envoi.
- Un add-on ID (`gecko.id`) est requis.

Source : https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/. Signature en ligne de commande : `web-ext sign --channel=unlisted` (https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#web-ext-sign).

✅ **Mises à jour automatiques** via `browser_specific_settings.gecko.update_url` : un JSON `updates.json` servi **en HTTPS**, avec un `update_link` HTTPS (ou un `update_hash`).
- **Vérification toutes les 24 h** par défaut (`extensions.update.interval` = 86400).
- L'`update_url` de la version installée fait foi. S'il casse ou change, les installations existantes ne peuvent pas trouver la nouvelle URL ; seule une politique d'entreprise permet de rattraper.
- Source : https://extensionworkshop.com/documentation/manage/updating-your-extension/ ; installation par lien : https://extensionworkshop.com/documentation/publish/self-distribution/ (ne fonctionne pas sur Android).

⚠️ **Un utilisateur peut rester bloqué sur une ancienne version.** Plusieurs causes possibles :
- (a) ✅ mises à jour auto mises sur « Off » pour cet add-on dans about:addons (https://support.mozilla.org/en-US/kb/how-update-add-ons) ;
- (b) jusqu'à environ 24 h de retard, plus Firefox fermé ;
- (c) ✅ une mise à jour qui **demande de nouvelles permissions** affiche une invite (https://extensionworkshop.com/documentation/develop/test-permission-requests/). 🔎 Elle reste en attente tant que l'utilisateur n'a pas accepté ;
- (d) `update_url` injoignable.

→ Côté API, prévoir un **contrôle de version minimale**, par exemple un en-tête `X-Extension-Version` et une réponse 426 avec un message « mettez à jour ».

---

**Conséquence pratique (déduction)** : on peut utiliser simplement le cookie de session existant (host permission + `credentials: 'include'` + `"moz-extension://"` dans `trustedOrigins`). C'est le plus simple, mais cela repose sur un comportement de Firefox voulu et non documenté. Le bearer est contractuel côté Better Auth, mais il faut stocker le jeton dans `storage.local` et exige quand même `moz-extension://` dans `trustedOrigins` pour le login.
