# 04: Squelette de l'extension : se connecter depuis Firefox

**What to build:** l'extension se lance en dev dans Firefox. Un clic sur l'icône ouvre et ferme la sidebar, qui suit l'onglet actif. On s'y connecte (e-mail et mot de passe, puis code du second facteur ou code de secours) et s'y déconnecte. Elle montre les écrans « Ta session a expiré » (e-mail rempli), « Extension à mettre à jour » (`426`), « BattleCRM ne répond pas » avec « Réessayer », et ailleurs « Ouvre un profil LinkedIn pour voir ou ajouter un Contact. ». Sources : [spec extension](../../battlecrm-extension/spec.md) §2, §3, §9, §10, §13 (A4 à A7), §16 ; ST-110, ST-111, ST-115, ST-116, ST-121, ST-122, ST-123.

**Blocked by:** 01, 03

**Status:** resolved

- [x] Workspace `apps/extension` en WXT épinglé (`imports: false`, plugins Vite du catalog), dans `pnpm check` (`wxt prepare` avant `tsc -b`, `references` racine) ; `pnpm build` produit le build Firefox
- [x] Manifeste : MV3, Firefox ≥ 140, `data_collection_permissions: none`, `gecko.id` `battlecrm@<domaine>`, `host_permissions` LinkedIn et origine de l'app (passée au build, `localhost` en dev), ni `tabs` ni `activeTab` ni `scripting` ; `update_url` prévu
- [x] `sidebarAction.toggle()` appelé de façon synchrone dans `action.onClicked`, sans popup
- [x] Background (event page) seul détenteur du client `hc<AppType>` (Bearer, `X-Client`, `credentials: 'omit'`), du jeton (`storage.local`, relu au réveil) et du traitement de `401`, `426`, erreurs réseau ; messages en union discriminée écrite à la main avec `send()`
- [x] Sidebar en React, React Aria, Tailwind, thème et `@battlecrm/ui` ; TanStack Query sur `send()` ; langue du navigateur (`fr`, `en` à défaut) ; thème du système ; écrans par ordre de priorité (spec §3) ; « Se déconnecter » dans le pied, sans confirmation, qui révoque la session et efface le jeton
- [x] Projet Vitest `extension` : instance Chromium pour la sidebar avec un faux background au niveau de `send()`, instance Firefox prête pour la lecture de LinkedIn ; axe sur chaque écran, deux thèmes ; CI et `CLAUDE.md` en `playwright install chromium firefox`
- [x] Dev : `pnpm --filter @battlecrm/extension dev` sur `localhost`, profil Firefox persistant dans un `web-ext.config.ts` git-ignoré

## Comments

**2026-10-31, implémentation (agent).**

- `apps/extension` en WXT `0.21.4` épinglé, `imports: false`, `browser: 'firefox'`, `srcDir: 'src'`. `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `web-ext` passent au catalog (la web aussi). `postinstall: wxt prepare` ; `apps/extension` dans les `references` du `tsconfig.json` racine ; `pnpm build` lance `wxt build -b firefox` (le background fait 19 kB).
- Manifeste : `gecko.id` **`battlecrm@romainsire.com`**. Choisi ici, à confirmer par Romain avant la première signature AMO (ticket 10) : après, il ne change plus. Seule permission : `storage`. `host_permissions` : LinkedIn et l'hôte de `APP_ORIGIN` **sans son port** (`http://localhost/*` en dev). Firefox 159 affiche `http://localhost:5173/*` comme accordé, mais soumet quand même le background à CORS : la requête part en preflight et échoue. Essai du 2026-10-31. `update_url` vers `<APP_ORIGIN>/extension/updates.json`, seulement pour une origine en HTTPS : Firefox refuse d'installer une extension dont l'`update_url` est en HTTP, avec un message trompeur (« not compatible with application version »). Le build de dev, sur `localhost`, n'en a donc pas. Icône : le logo, trait teal.
- Origine : `APP_ORIGIN` de l'environnement au build, `http://localhost:5173` par défaut (le serveur de la SPA, qui relaie `/api`). Le job de livraison (ticket 10) devra la fournir. Le serveur de dev de WXT est sur le port 3010, parce que l'API tient le 3000.
- Background (`src/background/background.ts`, `createBackground`) : client `hc<AppType>` avec `headers` asynchrone (Bearer et `X-Client: extension/<version du manifeste>`) et `init: { credentials: 'omit' }`. `storage.local` garde `token`, `email` et `challenge` (le défi du second facteur, rapporté avec le code), relus à chaque appel. Le `fetch` du client est le seul endroit qui traite `426` (→ `outdated`) et `401` avec un jeton (le jeton est effacé, l'e-mail gardé : « session expirée »). Réseau ou `5xx` → `unreachable` pour la vérification de la session. À la connexion, comme dans l'app, une erreur réseau affiche « Quelque chose n'a pas fonctionné » dans le formulaire, et non l'écran « ne répond pas ». La déconnexion révoque si l'API répond et oublie tout dans tous les cas.
- Messages : union écrite à la main dans `src/messages.ts` (`session`, `signIn`, `verifyCode`, `signOut`) avec `send()`.
- `EmailField`, `PasswordField` et `CodeField` passent de `apps/web` à `packages/ui` (la sidebar s'en sert). `isTotpCode` passe dans `packages/contract` (`second-factor.ts`), marqué `sideEffects: false` pour que Zod n'entre pas dans le background.
- Sidebar : écrans du §3 (mise à jour, connexion avec second facteur, session expirée, ne répond pas, ailleurs). Pied « Connecté : <e-mail> » et « Se déconnecter ». « Second facteur perdu » n'est pas proposé : sa demande repose sur le cookie de l'app. La langue du navigateur passe par `overwriteGetLocale`, le thème suit le système. Nouveaux messages `extension_*` en fr et en.
- Tests (projet Vitest `extension`) : background contre un faux `fetch` ; sidebar contre un faux `send()` ; axe sur 7 écrans dans les deux thèmes ; instance Firefox prête pour `src/linkedin/**` (ticket 05). CI et `CLAUDE.md` en `playwright install chromium firefox`.
- Dev : copier `apps/extension/web-ext.config.example.ts` en `web-ext.config.ts` (git-ignoré) et y mettre le chemin du profil.
- Pour plus tard : `X-App-Version` n'est pas encore lu par le background (spec §9). Le badge `!` sans session (A6) revient au ticket du badge.
- Suggéré, jamais obligatoire : lancer `pnpm --filter @battlecrm/extension dev` dans un vrai Firefox, cliquer sur l'icône, se connecter (avec et sans second facteur), se déconnecter, et vérifier les points 🔎 de research/18 (ticket 03).
