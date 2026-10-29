# Outillage d'une extension Firefox MV3 en 2026 : build, UI, tests, signature, client API

Recherche du 2026-10-29 pour le ticket 02. Versions lues ou installées ce jour :

| Outil | Version | Publiée le | Remarque |
|---|---|---|---|
| `wxt` | 0.21.5 (0.21.4 avant) | 2026-10-26 (0.21.4 : 2026-08-11) | 0.21.5 a moins de 7 jours : `minimumReleaseAge` installera **0.21.4** jusqu'au 2026-11-02 |
| `@wxt-dev/module-react` | 1.2.2 | 2026-03-14 | |
| `@wxt-dev/browser` | 0.3.7 | 2026-10-28 | types de `browser` |
| `web-ext` | 10.8.0 (10.7.0 avant) | 2026-10-15 | `addons-linter` 10.14.0 embarqué |
| `vite` | 8.3.2 (repo), 8.3.5 sur npm | | |
| `typescript` | 7.0.2 | | |
| `vitest` / `@vitest/browser-playwright` / `playwright` | 4.1.11 / 4.1.11 / 1.63.0 (Firefox Playwright 155.0) | | versions du repo |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 | | version du repo |
| `react-aria-components` | 1.21.1 | | version du repo |
| `hono` | 4.13.12 | | version du repo |
| `puppeteer-core` | 25.16.0 | 2026-10-22 | |
| `selenium-webdriver` | 4.51.0 | 2026-10-09 | |
| Firefox | 158.0.1 (Fedora, poste de Romain ; même version sur l'image `ubuntu-24.04` de GitHub Actions, avec geckodriver 0.37.1) | | |
| Source Firefox | `main` @ `bf754717` (2026-10-29) | | |
| `@mdn/browser-compat-data` | 8.1.7 (2026-10-22) | | |

Abréviations : **FF/**`<chemin>:<ligne>` = `https://github.com/mozilla-firefox/firefox/blob/bf75471716c53f2d8e94284f3d37ad6f209459d6/<chemin>#L<ligne>` ; **WXT/**`<chemin>` = `https://github.com/wxt-dev/wxt/blob/bdfcc52f37d910a81ebbe319697a263e05408a17/<chemin>` (`main`, 2026-10-29) ; **BCD** = `@mdn/browser-compat-data` 8.1.7.

Légende : ✅ fait documenté ou lu dans le code · 🧪 constaté dans un essai (bac à sable `/tmp/claude-1000/ext-research`, hors repo) · 🔎 déduction, pas vérifiée · ⚠️ point d'attention.

Point de départ : le POC V1 (`../BattleCRM/apps/extension`) tourne sur **WXT 0.20.26**, `web-ext` 10.4, React 19, shadcn (Radix), i18next, Biome, Vitest en `environment: 'node'`. Il force `manifestVersion: 3` (WXT vise MV2 par défaut pour Firefox), déclare `gecko.id`, `strict_min_version: '115.0'` et `data_collection_permissions: { required: ['none'] }`. Son workflow `release.yml` (tag `v*`) construit, signe par `web-ext sign --channel unlisted` avec les secrets `AMO_JWT_ISSUER`/`AMO_JWT_SECRET` passés en `WEB_EXT_API_KEY`/`WEB_EXT_API_SECRET`, puis attache le `.xpi` à une GitHub Release.

---

## 1. Build

### 1.1 WXT : état et maintenance

- ✅ **Toujours en 0.x.** « Currently, WXT is in pre-release. This means changes to the second digit, `v0.X`, are considered major and have breaking changes. » (WXT/docs/guide/resources/upgrading.md). La 0.21 a été publiée le 2026-02-22 (npm), puis 0.21.1 à 0.21.5 de juillet à octobre 2026, à peu près une version par mois.
- ✅ Dépôt actif : 10,7 k étoiles, 190 tickets ouverts, dernier push le 2026-10-29 (API GitHub). Mainteneur principal : Aaron Klinker (`aklinker1`), avec de nombreux contributeurs ponctuels.
- ✅ Son prédécesseur, `vite-plugin-web-extension` (même auteur, 4.5.1 du 2026-04-06), annonce dans son README qu'il sera **déprécié au profit de WXT**. `@samrum/vite-plugin-web-extension` est **abandonné** : 5.1.1 du 2024-09-26, peer `vite ^4 || ^5`.
- ✅ CRXJS (`@crxjs/vite-plugin` 3.0.0 du 2026-09-24, peer `vite` jusqu'à 8) a des branches de code `browser === "firefox"` (background en `scripts`, retrait de `use_dynamic_url`), mais la page de comparaison de WXT le note « 🟡 Supports all browsers » et « 🟡 Maintained » (WXT/docs/guide/resources/compare.md). 🔎 Il est pensé pour Chrome d'abord.

### 1.2 WXT 0.21 face à Vite 8 et TypeScript 7

- ✅ **Peers de 0.21.4 et 0.21.5** : `vite ^6.3.4 || ^7.0.0 || ^8.0.0-0` (obligatoire), `typescript >=5.4` (optionnel), `web-ext >=9.2.0` (optionnel), `eslint` (optionnel) ; `node >=22`. Depuis la 0.21, **`vite` et `web-ext` ne sont plus des dépendances directes**. C'est le projet qui fixe leur version, donc le catalog pnpm s'applique (WXT/docs/guide/resources/upgrading.md, « `vite`, `web-ext`, and `typescript` Are Now Peer Dependencies »). Sans `web-ext` installé, `wxt dev` n'ouvre simplement pas de navigateur.
- ✅ Empreinte réduite : 22 Mo et 156 paquets en 0.21, contre 98 Mo et 366 paquets en 0.20 (même page). Il reste des dépendances directes notables : `linkedom`, `publish-browser-extension`, `@webext-core/fake-browser`, `@webext-core/isolated-element`, `unimport`, `chokidar`, `c12`.
- ✅ WXT n'importe pas l'API programmatique de `typescript` : aucun `import 'typescript'` dans `wxt/dist`, seulement la commande `wxt prepare`, qui écrit des fichiers. L'absence d'API dans TS 7.0 (ADR 0014) **ne le gêne donc pas**.
- 🧪 **Essai** `wxt@0.21.5` + `vite@8.3.2` + `typescript@7.0.2` + `@wxt-dev/module-react` + React 19, `wxt build -b firefox` : build en ~0,4 s, sans avertissement. `tsc --noEmit` (TS 7.0.2) passe sur un `tsconfig.json` qui étend `.wxt/tsconfig.json` et ajoute `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature` et `erasableSyntaxOnly`. Une erreur de type volontaire est bien signalée.
- ✅ Le `.wxt/tsconfig.json` généré en 0.21 suit déjà presque `tsconfig.base.json` de V2 : `module: Preserve`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `strict` (upgrading.md, « `.wxt/tsconfig.json` Compiler Option Changes »). Il ajoute des alias `@`, `~`, `@@`, `~~` et `include: ["../**/*"]`.
- ⚠️ 🔎 Ce `.wxt/` est **généré** et git-ignoré. `tsc -b` à la racine (`pnpm typecheck`) doit donc trouver `wxt prepare` déjà exécuté (les gabarits WXT le lancent en `postinstall`). Sinon, le `tsconfig` de l'extension n'étend pas `.wxt/tsconfig.json` et se contente d'inclure `.wxt/wxt.d.ts` pour les globales. Dans les deux cas, `apps/extension` doit être ajouté aux `references` du `tsconfig.json` racine.
- ✅ **Auto-imports désactivables** : `imports: false`, puis import explicite depuis `#imports` (WXT/docs/guide/essentials/config/auto-imports.md, « Disabling Auto-imports »). 🔎 C'est plus simple pour Oxlint (`no-undef`) et pour la règle « imports explicites ».
- 🔎 `@wxt-dev/module-react` ne fait qu'ajouter `@vitejs/plugin-react` (accepte `^4 || ^5 || ^6`) et un préréglage d'auto-import (WXT/packages/module-react/modules/react.ts). On peut s'en passer : `vite: () => ({ plugins: [react(), tailwindcss()] })`, avec les versions du catalog. 🧪 Fait ainsi pour `@tailwindcss/vite` 4.3.3 : build correct.

### 1.3 Ce que WXT apporte, face à Vite + `web-ext` seuls

✅ D'après la documentation WXT (WXT/docs/guide/essentials/*.md) :
- Points d'entrée découverts par fichier (`entrypoints/background.ts`, `popup/index.html`, `*.content.ts`…) et manifeste **généré** (permissions, `content_scripts`, `action.default_popup`, `background`). Valeurs par navigateur, version tirée du `package.json`.
- **Content scripts en IIFE**, un bundle par script (« ESM Content Scripts ❌ », compare.md). Le background et les pages restent en modules.
- Dev : rechargement des pages HTML et des content scripts, HMR des pages, rechargement complet pour le background, ouverture d'un navigateur avec l'extension (si `web-ext` est installé).
- Utilitaires : `storage` typé (`@wxt-dev/storage`), `createShadowRootUi` / `createIntegratedUi` / `createIframeUi` avec `autoMount` (montage et démontage quand l'ancre apparaît ou disparaît), `ctx` (invalidation du content script), évènement `wxt:locationchange` pour les SPA.
- `wxt zip` produit aussi le **zip des sources** pour AMO, et `wxt submit` publie (`publish-browser-extension` 6.2.0, canal Firefox réglable).
- `WxtVitest()` : `browser` simulé en mémoire (`@webext-core/fake-browser`) et alias.

🧪 **Manifeste généré pour Firefox MV3** (essai) : `"background": { "scripts": ["background.js"] }`, donc une event page et pas de `service_worker`. `action.default_popup`, `content_scripts` et `host_permissions` sont repris tels quels.

✅ **Types `browser`** : ils viennent de `@types/chrome` (`@wxt-dev/browser`, « types based on @types/chrome »). Les API propres à Firefox (`browser.sidebarAction`…) ne sont **pas typées**. La doc propose d'augmenter le module avec `webextension-polyfill` ou `@types/firefox-webext-browser` (143.0.1) (WXT/docs/guide/essentials/extension-apis.md, « Add Firefox Types »). Ticket ouvert : wxt-dev/wxt#1652 « Add support for Firefox-specific APIs ».

🔎 **Vite + `web-ext` sans WXT**, ce qu'il faut écrire soi-même :
- un `manifest.json` à la main, et l'injection de la version ;
- une **deuxième config Vite par content script** : un content script déclaré dans le manifeste ne peut pas être un module ES, et une sortie IIFE n'accepte pas plusieurs entrées avec découpage de code ;
- `web-ext run --watch-file` pour recharger en dev ;
- le zip des sources ;
- un faux `browser` pour les tests.

Rien de difficile, mais c'est ce que WXT fait déjà. ✅ `web-ext run` installe l'extension **temporairement** par le protocole de débogage distant de Firefox (`installTemporaryAddon`, `web-ext/lib/firefox/remote.js:80`) et la recharge à chaque modification.

### 1.4 Background MV3 de Firefox : une event page, pas un service worker

- ✅ « `background.service_worker` is not supported (see Firefox bug 1573659) » ; Firefox prend `background.scripts` (ou `page`). Depuis **Fx 121**, le background démarre même si `service_worker` est aussi présent. MDN, page `manifest.json/background`, modifiée le 2026-10-14. ✅ Le bug 1573659 est toujours **NEW**, P3 (Bugzilla, 2026-10-29). ✅ `extensions.backgroundServiceWorker.enabled` est **verrouillé à `false`** en build release (FF/modules/libpref/init/all.js:1755-1758).
- ✅ BCD : `background.type` (`"module"`) depuis **Fx 112** ; `storage.session` depuis **115** ; `host_permissions` et `action` depuis **109** ; `action.openPopup` sans geste utilisateur depuis **149**.
- ✅ **Une event page a un `window` et le DOM** : « This gives them a `window` global, along with all the standard DOM APIs » (MDN Background_scripts, modifiée le 2026-10-14). 🧪 Constaté : `typeof document` et `typeof DOMParser` valent `"object"`/`"function"` dans le background.
- ✅ **Effets sur le code** (même page MDN) :
  - l'event page se décharge après « a few seconds of inactivity » ;
  - les écouteurs doivent être enregistrés **de façon synchrone au démarrage** ;
  - pas de variable globale durable : utiliser `storage.session` ou `storage.local` ;
  - `setTimeout` ne survit pas au déchargement : utiliser `alarms` ;
  - pas d'`alert`/`confirm`/`prompt` ;
  - les ports de message n'empêchent pas l'arrêt ;
  - après un plantage, l'event page redémarre au prochain évènement.
- ✅ **Durée exacte** : la préférence `extensions.background.idle.timeout` vaut **30 000 ms** par défaut, bornée de 100 ms à 5 min (FF/toolkit/components/extensions/parent/ext-backgroundPage.js:27-35). Avant d'arrêter la page, Firefox **relance le délai une fois** si des promesses d'écouteurs sont encore en attente, par exemple un `onMessage` asynchrone qui attend un `fetch` (:900-914). Le délai repart aussi à chaque appel d'API d'extension (`reason: "parentapicall"`) et à chaque évènement (:776-807).
- 🔎 Pour notre cas (le content script ou la popup demande, le background `fetch` l'API puis répond), une requête de moins de 30 s ne risque rien. Le jeton doit être relu depuis `storage.local` à chaque réveil : aucun cache en variable globale.
- ✅ WXT : `defineBackground(main)` ; le code doit être **dans `main`**, car WXT importe le fichier dans Node au build, et `main` ne peut pas être `async` (WXT/docs/guide/essentials/entrypoints.md, « Background »). ⚠️ Cette page dit encore « For MV3, the background becomes a service worker », ce qui est faux pour Firefox ; le manifeste généré est bien en `scripts` (🧪).

## 2. UI

### 2.1 Page d'extension (popup, sidebar) : React + React Aria + Tailwind

- 🧪 Popup React 19 construite par WXT : un bloc de **219 kB** (React DOM compris), affiché sans erreur dans Firefox 158 (essai Puppeteer, §3.3). Une page d'extension est une page `moz-extension://` ordinaire : elle a sa propre origine, la CSP MV3 par défaut (`script-src 'self'`) et aucun conflit de style avec LinkedIn. 🔎 React Aria, Tailwind et `packages/theme` s'y utilisent comme dans `apps/web`, avec les mêmes paquets et les mêmes règles.
- ⚠️ 🧪 `web-ext lint` signale 2 avertissements `UNSAFE_VAR_ASSIGNMENT` (« Unsafe assignment to innerHTML ») dans le bundle React DOM. Ce ne sont que des avertissements : ils n'empêchent ni la validation ni la signature (🔎), mais ils rendent `--warnings-as-errors` inutilisable tel quel.

### 2.2 Content script : React + Tailwind en Shadow DOM, ou DOM natif

🧪 **Coût mesuré** (`wxt build -b firefox`, minifié) :

| Content script | JS | gzip | CSS |
|---|---|---|---|
| DOM natif (créer un `<span>`, runtime WXT compris) | 3,8 kB | 1,4 kB | — |
| `createShadowRootUi` + React 19 + Tailwind 4.3.3 (une pastille) | 231 kB | 72 kB | 9,2 kB (2,5 kB gzip) |

🔎 Le fichier est local (pas de réseau), mais il est analysé et exécuté **à chaque chargement de page LinkedIn**, donc dans chaque onglet LinkedIn. Il s'ajoute au bundle de la popup, qui n'est pas partagé.

✅ **Tailwind 4 et Shadow DOM** :
- Tailwind 4 déclare ses variables par `@property`. Le ticket tailwindlabs/tailwindcss#15005 (« @property isn't supported in shadow roots », ouvert le 2024-11-14) est **toujours ouvert**, avec 33 commentaires et des contournements tiers : remonter les `@property` dans le `<head>` de la page, ou le plugin `vite-plugin-tailwind-shadowdom`.
- Tailwind 4.3.3 émet `:root,:host` pour les jetons du thème. Il ajoute aussi un repli `@layer properties` réservé aux navigateurs qui n'ont pas `@property` : la condition `@supports` vise les anciens Safari et les Firefox sans couleurs relatives.
- 🧪 **Dans Firefox 158**, une pastille `bg-emerald-600 … shadow` montée par `createShadowRootUi` s'affiche correctement : `--tw-shadow` est résolu et `box-shadow` est complet. Le CSS contient 32 règles `@property`. 🔎 Le problème du #15005 ne se voit donc pas dans ce Firefox pour ces utilitaires. Ce n'est pas garanti pour tous, et ce n'est documenté nulle part.
- ✅ WXT prévient que les unités `rem` **ne sont pas isolées** : elles suivent la taille de police de `<html>` de la page hôte, donc l'UI change d'échelle selon le site (WXT/docs/guide/essentials/content-scripts.md, « `rem` Units Are Not Fully Isolated »). 🔎 Sur LinkedIn, cela vaut pour tout le thème Tailwind (espacements, `text-*`).
- ✅ WXT 0.21 : la racine de l'ombre ne contient plus qu'un `<style>` et un `<div>` (plus de `<html>`/`<body>` imbriqués), et le CSS doit cibler `:host` (upgrading.md, « `createShadowRootUi` DOM Changes »).

✅ **React Aria en Shadow DOM : expérimental.**
- Dans `react-aria-components` 1.21.1, le support passe par un drapeau à activer, `enableShadowDOM()`, importé d'un chemin **privé** : `react-stately/private/flags/flags`. Sans ce drapeau, `contains`, `activeElement` et la cible des évènements ignorent les racines d'ombre (`react-aria/dist/private/utils/shadowdom/DOMFunctions.mjs`).
- Un mainteneur l'écrit le 2026-05-14 : « shadowDOM support in general, it is still considered experimental hence why we didn't call it out in the docs » (adobe/react-spectrum#10051). Dans ce ticket, des `Button` et `Checkbox` montés dans une racine d'ombre étaient **inertes à la souris** tant que le drapeau n'était pas activé.
- 🔎 Les overlays (Popover, Tooltip) se rendent dans `document.body` par défaut, donc **hors** de la racine d'ombre et sans ses styles ; il faudrait `UNSAFE_PortalProvider`.

🔎 **Pour une simple pastille** (sur un profil ou sur chaque résultat de recherche), le DOM natif suffit. C'est ce que fait le POC : `document.createElement`, SVG en ligne, sans `web_accessible_resources`. Il coûte ~1,4 kB gzip, n'a ni problème de `rem` ni drapeau expérimental, et s'isole avec une racine d'ombre et quelques règles CSS écrites à la main. React en Shadow DOM ne se justifie que pour une UI riche **dans** la page (formulaire, menu). Si le formulaire d'ajout vit dans une page d'extension (popup, sidebar, fenêtre ; voir le ticket 01), il n'en a pas besoin.

## 3. Tests

### 3.1 Unitaires sur fixtures HTML : jsdom ou mode navigateur

- 🧪 **jsdom 30.1.3 n'a pas `innerText`** (`undefined`). Seul `textContent` existe ; il colle les blocs (`<p>Mathématicienne<br>Londres</p>` donne `"MathématicienneLondres"`). Dans **Firefox (Vitest 4.1.11, mode navigateur, Playwright Firefox 155.0)** :
  - sur un document issu de `DOMParser`, donc non rendu, `innerText` vaut `textContent` ;
  - sur le **document vivant**, `innerText` vaut `"Mathématicienne\nLondres"`.
  🔎 Un scraper qui lit `innerText` ou dépend du rendu (`display:none`) ne se teste fidèlement qu'en mode navigateur, sur une fixture **injectée dans le document** (`document.body.innerHTML = …`).
- ✅ Le repo fait déjà tourner le projet Vitest `web` en mode navigateur (`@vitest/browser-playwright`, `instances: [{ browser: 'chromium' }]`). 🧪 `instances: [{ browser: 'firefox' }]` fonctionne avec le Firefox téléchargé par Playwright 1.63 (`pnpm exec playwright install firefox`). C'est un Firefox **modifié par Playwright** (Juggler), pas le Firefox de l'utilisateur, mais c'est le même moteur Gecko.
- 🧪 ⚠️ **`WxtVitest()` casse en mode navigateur** : « Failed to import test file …/virtual:wxt-setup … error loading dynamically imported module ». Il marche en `environment: 'jsdom'` (où `browser` est bien simulé) ; la doc ne le présente qu'en environnement Node/jsdom (WXT/docs/guide/essentials/unit-testing.md). 🔎 Deux issues : séparer un projet `extension-dom` en mode navigateur, sans `WxtVitest` (scraping pur sur des fixtures, sans `browser.*`), d'un projet jsdom/Node avec `WxtVitest` (logique du background) ; ou garder le scraping en fonctions pures qui prennent un `Document`.

### 3.2 Bout en bout dans Firefox : Playwright ne sait pas

- ✅ Playwright : « Extensions only work in Chromium when launched with a persistent context » (microsoft/playwright, `docs/src/chrome-extensions-js-python.md`, `main` du 2026-10-29). Le ticket microsoft/playwright#7297 (« Support running extensions with Firefox ») a été **fermé le 2024-12-03** par Pavel Feldman : « Support for Firefox extensions is outside of the scope for Playwright ». #36728 (installer un `.xpi`) a été replié dedans le 2025-07-22.
- ✅ Contournements tiers cités dans #7297 :
  - `playwright-webextext` (0.0.5, 34 étoiles) installe une extension temporaire par le protocole de débogage distant ;
  - une politique d'entreprise `ExtensionSettings` (`force_installed`, `install_url: file://…xpi`), qui suppose un `.xpi` signé.
  🔎 Aucun n'est maintenu par Playwright.
- ✅ **WebDriver BiDi `webExtension.install`** est implémenté dans Firefox depuis **Fx 137** (bug 1934551, résolu le 2025-02-15, milestone 137). Il accepte un dossier (`path`), une archive (`archivePath`) ou du `base64`. L'installation est **temporaire par défaut** (`moz:permanent: false`), donc **sans signature** ; une installation permanente d'un dossier non empaqueté est refusée (FF/remote/webdriver-bidi/modules/root/webExtension.sys.mjs:144-212).
- ✅ **Puppeteer** a `browser.installExtension(path)` / `uninstallExtension(id)` depuis **24.8.0** (2025-05-02, puppeteer#13810). En BiDi, il appelle `webExtension.install` avec `{type: 'path'}` (`packages/puppeteer-core/src/bidi/core/Browser.ts:263-270`). Puppeteer parle BiDi directement à Firefox, sans geckodriver.
- ✅ **Selenium JS 4.51.0** : `driver.installWebExtension(dirOuXpi)` exige BiDi (`enableBidi()`). L'ancien `firefox.Driver#installAddon(path, temporary)` (commande geckodriver) est **déprécié** (`selenium-webdriver/lib/webdriver.js:1788-1818`, `firefox.js:548-575`). Selenium passe par geckodriver, que Selenium Manager télécharge.
- ✅ `web-ext run` n'est **pas** un outil de test : il installe l'extension et la recharge, sans piloter de page.

🧪 **Essai Puppeteer 25.16.0 + Firefox 158.0.1** (headless, profil jetable), sur l'extension WXT de l'essai :
- `installExtension(.output/firefox-mv3)` prend **~1,2 s**. Le content script est injecté sur une page `http://127.0.0.1` servie localement, et `runtime.sendMessage` fait l'aller-retour avec l'event page.
- **UUID fixé** par la préférence `extensions.webextensions.uuids = {"<gecko.id>":"<uuid>"}` (`extraPrefsFirefox`), ce qui donne l'URL `moz-extension://<uuid>/popup.html`. La popup s'ouvre **dans un onglet**, React s'y affiche, `permissions.contains` renvoie `true` pour la host permission.
- ⚠️ ✅ **Depuis Fx 153**, BiDi **refuse de naviguer** vers `moz-extension://` (« Navigation to "moz-extension://…" is not allowed in this context »). Seuls `blob`, `file`, `http`, `https` et `about:blank` sont « WebDriver safe » (FF/remote/shared/BrowsingContextUtils.sys.mjs:16, :139-161 ; bug 1579790, milestone 153). Le refus se lève avec la variable d'environnement **`MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1`** (FF/remote/components/RemoteAgent.sys.mjs:28, :60 ; FF/remote/webdriver-bidi/modules/root/browsingContext.sys.mjs:1435-1443).
- 🧪 ⚠️ Même avec cette variable, `page.goto('moz-extension://…')` **n'aboutit jamais** pour Puppeteer (délai dépassé, `page.url()` reste `about:blank`), alors que la page est chargée et utilisable : `waitForSelector` et `evaluate` marchent. Il faut donc un `goto` avec `.catch()`, puis attendre un sélecteur.
- 🔎 La **vraie popup** (clic sur le bouton de la barre d'outils) et la sidebar sont de l'interface du navigateur : BiDi ne les atteint pas. On teste leur page HTML dans un onglet.
- 🧪 Au passage, cet essai **confirme dans un vrai Firefox 158** trois points 🔎 de [research/18](../../battlecrm-stack/research/18-extension-firefox-auth.md) §1 : un `fetch` du background avec `Authorization: Bearer` et `credentials: 'omit'` vers une origine en host permission envoie **`Origin: moz-extension://<uuid>` sur POST seulement**, rien sur GET, et `Sec-Fetch-Site: same-origin`.
- ✅ `@wxt-dev/runner` (0.1.3), futur remplaçant de `web-ext` dans WXT (Firefox ≥ 139), se dit « not ready at the moment ». Le ticket wxt-dev/wxt#1699 « Explore using `@wxt-dev/runner` to enable Playwright E2E tests on Firefox » est ouvert (WXT/packages/runner/README.md).
- ✅ L'image `ubuntu-24.04` de GitHub Actions fournit **Firefox 158.0.1 et geckodriver 0.37.1** (actions/runner-images, `Ubuntu2404-Readme.md` du 2026-10-28). 🔎 Puppeteer peut donc utiliser ce Firefox en CI (`executablePath`) sans rien télécharger.

### 3.3 Linter AMO

- ✅ `web-ext lint` (addons-linter 10.14.0) : « Reports errors in the extension manifest or other source code files » ; `--self-hosted` (extension auto-hébergée), `-w/--warnings-as-errors` (Extension Workshop, web-ext command reference).
- 🧪 Il signale en **erreur** une version `0.8.0-rc.1` (`VERSION_FORMAT_INVALID`). Il signale en **avertissement** `data_collection_permissions` absent (`MISSING_DATA_COLLECTION_PERMISSIONS`) et `data_collection_permissions` avec `strict_min_version: 115.0` (« Manifest key not supported by the specified minimum Firefox version »).

## 4. Signature et livraison

### 4.1 `web-ext sign --channel unlisted`

✅ Options de `web-ext` 10.8.0 (`lib/program.js:427-467`) :
- `--api-key` (« JWT issuer ») et `--api-secret` (« JWT secret ») sont obligatoires ; ✅ toute option se passe aussi en variable `WEB_EXT_*` (`envPrefix = 'WEB_EXT'`), soit `WEB_EXT_API_KEY` et `WEB_EXT_API_SECRET`, comme dans le POC ;
- `--channel` est **obligatoire** depuis web-ext 8 (`listed` ou `unlisted`) ;
- `--amo-metadata` (JSON, utile surtout en `listed`), `--upload-source-code` (archive des sources), `--approval-timeout` (0 = ne pas attendre), `--timeout`, `--amo-base-url`, `--api-proxy`.

✅ **Délais par défaut** : validation 5 min, approbation **15 min** (`validationCheckTimeout = 300000`, `approvalCheckTimeout = 900000`, `lib/util/submit-addon.js:55-59`). Une fois approuvé, le `.xpi` signé est téléchargé dans `--artifacts-dir`. ✅ En non listé, la signature prend « up to 24 hours », d'ordinaire quelques minutes ; l'extension reste soumise à une revue manuelle à tout moment (déjà dans research/18 §4).

✅ **Clés AMO** : à générer dans le compte développeur AMO (page « API key », `https://addons.mozilla.org/developers/addon/api/key/`). 🔎 Elles vont en secrets GitHub (`AMO_JWT_ISSUER`, `AMO_JWT_SECRET` dans le POC).

✅ **Version unique, à jamais** : addons-server refuse une version déjà envoyée, même supprimée : « Version {version_string} already exists. » / « … was uploaded before and deleted. » (`mozilla/addons-server`, `src/olympia/versions/utils.py:191-203`, `master` du 2026-10-29 ; blog Mozilla Add-ons, 2016-03-09, « AMO updates on version number re-use » : « This restriction applies to add-ons that are uploaded for signing and external listing as well »). La règle « plus grande que la dernière version » ne vise que le canal **listé** (`validate_version_number_is_gt_latest_signed_listed_version`, :206-221).
- 🔎 En non listé, une version plus basse serait acceptée par AMO, mais Firefox ne mettrait pas à jour vers elle par `update_url`.
- ⚠️ 🔎 Le `release.yml` de V2 permet de « livrer à nouveau » un tag (`workflow_dispatch`). Une deuxième signature du même numéro échouera : l'étape de signature doit être sautée ou réutiliser le `.xpi` déjà signé (asset de la release).

✅ **Format de version** : 1 à 4 nombres séparés par des points, sans zéro initial. AMO accepte au plus 9 chiffres par nombre (`^(0|[1-9][0-9]{0,8})([.](0|[1-9][0-9]{0,8})){0,3}$`), et Firefox avertit depuis **Fx 108** si la version n'y correspond pas (MDN `manifest.json/version`, modifiée le 2026-02-20).
- 🔎 Le numéro SemVer du `package.json` racine (`0.7.0`) convient tant qu'il n'a **ni suffixe de préversion ni métadonnées** (`-rc.1`, `+build`).
- ✅ WXT tire `version` du `package.json` et distingue `version` de `version_name` : `"1.3.0-alpha2"` donne `version: "1.3.0"` et `version_name: "1.3.0-alpha2"` (WXT/docs/guide/essentials/config/manifest.md:103-121). ⚠️ 🔎 Deux préversions `0.8.0-rc.1` et `0.8.0-rc.2` donneraient alors la même `version`, que AMO refuserait la deuxième fois.

### 4.2 `data_collection_permissions`

- ✅ Obligatoire pour les **nouvelles** extensions depuis le **2025-11-03**, pas encore pour les nouvelles versions d'extensions existantes : « This will apply to new extensions only ». Une extension qui doit le déclarer et ne le fait pas « will be prevented from being submitted to addons.mozilla.org for signing ». Une fois la clé utilisée, elle doit rester dans toutes les versions suivantes. « In the first half of 2026, Mozilla will require all extensions to adopt this framework » (blog Mozilla Add-ons, 2025-10-23).
- ✅ Pris en charge par **Firefox 140** sur ordinateur et **142** sur Android (BCD : `browser_specific_settings.gecko.data_collection_permissions` depuis 140). Les versions antérieures doivent montrer leur propre écran de consentement si l'extension collecte des données ; sinon, on pose `strict_min_version: "140.0"` (Extension Workshop, « Firefox built-in data consent », mise à jour le 2026-10-18). Syntaxe sans collecte : `"data_collection_permissions": { "required": ["none"] }`.
- 🔎 Le texte dit « submitted … for signing » : il vise donc aussi le canal non listé. Le POC déclare déjà `none`. Ticket ouvert wxt-dev/wxt#2693 (2026-10-25) : avertissement de WXT sur cette clé en CI.

### 4.3 Mises à jour auto-hébergées (`update_url`)

✅ (Extension Workshop, « Updating your extension », page de 2019, et research/18 §4) :
- `browser_specific_settings.gecko.update_url` pointe vers un `updates.json` servi **en HTTPS**, de la forme `{ addons: { "<id>": { updates: [{ version, update_link, update_hash?, applications?: { gecko: { strict_min_version } } }] } } }`.
- `update_link` doit être en HTTPS, ou accompagné d'un `update_hash`.
- Firefox vérifie toutes les 24 h (`extensions.update.interval` = 86400 ; 120 est le minimum pour tester).
- L'`update_url` de la version **installée** fait foi.

🔎 Deux hébergements possibles, sans service ajouté :
- (a) l'app elle-même : nginx de `web` sert `/extension/updates.json` et le `.xpi`. L'origine est fixe et déjà en HTTPS, mais le `.xpi` doit alors entrer dans l'image ou être déposé au déploiement.
- (b) les **GitHub Releases** du dépôt (public : `RomainSire/BattleCRM`), avec `update_link` vers l'asset `.xpi` d'une release précise et `updates.json` servi par une URL stable (`releases/latest/download/updates.json`). ⚠️ Non vérifié : que le vérificateur de mises à jour de Firefox suive la redirection de GitHub vers `objects.githubusercontent.com`.

✅ Le POC ne déclarait **pas** d'`update_url` : ses installations ne se mettent pas à jour seules.

## 5. Client API : `hc<AppType>` depuis une page d'extension

✅ `ClientRequestOptions` de `hono` 4.13.12 (`dist/types/client/types.d.ts:25-54`) : `fetch?`, `init?: RequestInit` (« caution that this take highest priority and could be used to overwrite things that Hono sets for you, like `body | method | headers` »), `headers?: Record<string,string> | (() => Record<string,string> | Promise<…>)`.

🧪 Essai (Node, `hc` 4.13.12, faux `fetch`) :
- `hc(url, { headers: async () => ({ Authorization: 'Bearer …', 'X-Client': 'extension/0.8.0' }), init: { credentials: 'omit' } })` passe à `fetch` `credentials: 'omit'`, `authorization`, `x-client` et le `content-type: application/json` posé par Hono. Une fonction `headers` **asynchrone** est relue **à chaque requête** : elle peut lire le jeton dans `browser.storage.local`.
- ⚠️ Mettre des `headers` dans `init` **remplace tous** les en-têtes : `{ headers: {A}, init: { headers: {B} } }` n'envoie que `b`, et le `content-type` est perdu. Le jeton va donc dans `headers`, jamais dans `init`.

🔎 Le même `fetch` enveloppant que `apps/web/src/api-client.ts` (`onUnauthenticated` sur 401, lecture de `X-App-Version`) s'applique, avec en plus le traitement du `426`. ✅ Côté Firefox, le comportement réseau de ce `fetch` depuis une page d'extension est dans [research/18](../../battlecrm-stack/research/18-extension-firefox-auth.md), et 🧪 confirmé au §3.2 pour `Origin` et `Sec-Fetch-Site`. 🔎 `import type { AppType } from '@battlecrm/api'` fait entrer les types de l'API dans le projet TypeScript de l'extension, comme pour `apps/web` (dépendance de dev `workspace:*`).

---

## Ce qui reste incertain

- **Où vit le formulaire d'ajout** (popup, sidebar, fenêtre ou injecté) : c'est le ticket 01. Le choix « React en Shadow DOM » ne se pose que pour une UI injectée riche.
- **Tailwind 4 en Shadow DOM dans Firefox** : un seul utilitaire dépendant d'`@property` a été testé (`shadow`), et il marche dans Fx 158. Le ticket Tailwind #15005 reste ouvert ; les autres utilitaires (`ring`, `transform`, `gradient`) ne sont pas vérifiés.
- **E2E Firefox** : le chemin Puppeteer + BiDi marche (🧪), mais il est **fragile** : variable `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS` depuis Fx 153, `goto` qui n'aboutit pas sur `moz-extension://`. La vraie popup et la sidebar restent hors d'atteinte. Aucun outil de test « officiel » ne couvre une extension Firefox.
- **`WxtVitest` en mode navigateur** : l'échec vient d'un seul essai. Une configuration (alias de `virtual:wxt-setup`, `optimizeDeps`) le rendrait peut-être possible ; non creusé.
- **Signature non listée** : délai réel de l'approbation automatique en CI (défaut d'attente de 15 min dans `web-ext`), et demande éventuelle du zip des sources lors d'une revue manuelle. La page Extension Workshop sur les sources (2019) ne distingue pas listé et non listé.
- **`updates.json` sur GitHub Releases** : la redirection de GitHub n'est pas vérifiée.
- **Date de bascule de `data_collection_permissions` pour toutes les extensions** : « first half of 2026 » annoncé, sans date confirmée lue. Sans effet pour nous, puisque la clé est déclarée dès la première version.
- **WXT reste en 0.x** : chaque mineure peut casser (0.20 → 0.21 a changé `peerDependencies`, le `tsconfig`, les zips, `createShadowRootUi`). Renovate en PR manuelle s'impose.

---

**Conséquence pratique (déduction)** :
- **WXT 0.21 tient dans la stack V2** sans compromis bloquant : Vite 8 et TS 7 du catalog, React par `@vitejs/plugin-react`, auto-imports coupés. Il apporte le manifeste, les content scripts en IIFE, le dev et le zip des sources. Le prix : une dépendance en 0.x, un `.wxt/` généré avant `tsc -b`, et des types `browser` façon Chrome.
- **Vite + `web-ext` seuls** reste faisable, au prix d'environ deux configs Vite et d'un manifeste écrit à la main.
- Pour la **pastille**, le DOM natif est ~50 fois plus léger que React + Tailwind et évite deux zones grises (`rem`, React Aria en Shadow DOM).
- Le **scraping** se teste en mode navigateur (Firefox de Playwright) sur des fixtures injectées dans le document.
- Un **E2E dans un vrai Firefox** passe par Puppeteer + `installExtension` (BiDi) ; Playwright n'y suffit pas.
- La **signature** se fait par `web-ext sign --channel unlisted`, avec un numéro de version jamais réutilisé et sans suffixe de préversion.
