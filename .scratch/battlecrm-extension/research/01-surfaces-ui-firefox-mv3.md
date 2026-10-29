# Surfaces d'interface d'une extension Firefox MV3 : popup, sidebar, fenêtre détachée, injection

Recherche du 2026-10-29 pour le ticket 01. Versions lues :
- **Firefox `main` @ `bf754717`** (2026-10-29, Nightly 161.0a1). Pour dater un réglage, j'ai aussi lu les tags de release `FIREFOX_148_0_RELEASE`, `FIREFOX_149_0_RELEASE`, `FIREFOX_159_0_RELEASE`, `FIREFOX_140_0esr_RELEASE` et `FIREFOX_153_0esr_RELEASE`.
- **`mdn/browser-compat-data` `main` @ `aed1f62c`** (2026-10-29), données de compatibilité des pages MDN.
- Le 2026-10-29 : Firefox release **159.0**, ESR **153.6** (https://product-details.mozilla.org/1.0/firefox_versions.json).

Abréviations :
- **FF/**`<chemin>:<ligne>` = `https://github.com/mozilla-firefox/firefox/blob/bf75471716c53f2d8e94284f3d37ad6f209459d6/<chemin>#L<ligne>`.
- **BCD/**`<clé>` = donnée `webextensions.<clé>` de https://github.com/mdn/browser-compat-data (tableau « Browser compatibility » de MDN).

Légende : ✅ fait documenté ou lu dans le code · 🔎 déduction tirée du code, pas testée dans un navigateur · ⚠️ point d'attention.

Rappel du besoin : sur un profil LinkedIn, (a) montrer si la personne est déjà un Contact, (b) offrir un formulaire d'ajout **qui reste ouvert pendant que l'utilisateur copie/colle depuis la page**. Sur la recherche de personnes, (c) un badge de présence par résultat.

---

## 0. Ce que le POC a vraiment fait

✅ Le POC (`/home/romain/DEV/BattleCRM/apps/extension`) **n'utilise plus** `windows.create`. Le commit `c066b11` (2026-04-21, « remove panel entrypoint in favor of a unified popup ») a supprimé l'entrypoint `panel/` (fenêtre flottante `chrome.windows.create({ type: 'popup' })`). Il l'a remplacé par le **popup `action` standard**, dont l'état du formulaire est sauvegardé dans `storage.session` sous une clé par URL LinkedIn normalisée, pour survivre aux fermetures au clic extérieur. La rétrospective de l'epic 7 (commit `4ecc4cd`, § « Architecture pivot mid-epic: panel → popup ») ne donne pas d'autre raison technique.

✅ État final du POC :
- `content.ts` : détecte la navigation SPA (Navigation API + `MutationObserver`) et injecte dans la recherche un badge SVG en ligne, stylé par `element.style`, **sans Shadow DOM**.
- `background.ts` : badge de la barre d'outils **par onglet** (`setBadgeText({ text, tabId })`, `tabId` tiré de `sender.tab.id`).
- Permissions : `storage`, `activeTab`, `scripting`, `tabs`, plus `host_permissions: ['*://www.linkedin.com/*']`.

---

## 1. Popup `action` (bouton de barre d'outils)

✅ **Fermeture** : « When the user clicks anywhere outside the popup, the popup is closed » ; `window.close()` le ferme depuis son script (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Popups, modifiée le 2025-07-17). Seule exception : l'option de débogage « Disable popup auto-hide », réservée au développeur (même page).
- **Conséquence pour le copier/coller** : 🔎 cliquer dans la page LinkedIn pour sélectionner un texte ferme le popup. Le document du popup est détruit à chaque fermeture. Un raccourci clavier ou un clic sur l'icône le rouvre, mais l'utilisateur alterne alors sans cesse entre la page et le popup. C'est exactement ce que le POC compensait avec `storage.session`.

✅ **Taille** : redimensionnement automatique selon le contenu, **800×600 px au plus** (page Popups : « 800x600 pixels at most if that fits on the user's screen »). Dans le code : `maxWidth: 800, maxHeight: 600` (FF/browser/components/extensions/ExtensionPopups.sys.mjs:393-394). Si le bouton est rangé dans le menu des extensions, la hauteur est aussi bornée par la place disponible (`resizeBrowser`, même fichier :436-441).

✅ **Badge et titre par onglet** :
- `setBadgeText`, `setBadgeBackgroundColor` et `setTitle` acceptent `tabId` ou `windowId`, mais pas les deux. Sans les deux, la valeur est globale. Disponibles depuis **Fx 109** (BCD/api.action.setBadgeText…).
- MDN : avec `tabId`, « The text is reset when the user navigates this tab to a new page » ; environ 4 caractères visibles (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/action/setBadgeText, modifiée le 2026-09-10).
- ⚠️ **Nuance lue dans le code, importante pour LinkedIn (SPA)** : la remise à zéro des valeurs par onglet n'a lieu que pour une **vraie navigation**. `handleLocationChange` n'appelle `tabContext.clear(tab)` que si `fromBrowse` est vrai (FF/toolkit/components/extensions/ExtensionActions.sys.mjs:172-176). `fromBrowse` est faux pour `history.pushState` ou un changement de hash (`LOCATION_CHANGE_SAME_DOCUMENT`, FF/browser/components/extensions/parent/ext-browser.js:259-263).
  - 🔎 Résultat : passer d'un profil à un autre **dans LinkedIn** (pushState) **conserve** le badge du profil précédent. L'extension doit l'effacer ou le recalculer elle-même, comme le faisait le POC avec `CLEAR_BADGE`.
- ✅ La sidebar **n'a pas de badge** : `sidebarAction.setBadgeText` est absent de Firefox (BCD/api.sidebarAction.setBadgeText = false). Le badge de présence sur un profil passe donc forcément par `action`.

✅ **Ouverture par programme `action.openPopup()`** :
- Disponible depuis **Fx 109**. BCD : « Before Firefox 149, a user gesture is required to call this API » (BCD/api.action.openPopup).
- Dans le code : sans geste utilisateur, l'appel lève « openPopup requires a user gesture », sauf si le réglage `extensions.openPopupWithoutUserGesture.enabled` est vrai (FF/browser/components/extensions/parent/ext-browserAction.js:1088-1099). Ce réglage vaut `true` (FF/modules/libpref/init/all.js:1760).
- J'ai lu les tags pour dater le changement : Fx 148 → réglage sous `#ifdef NIGHTLY_BUILD`, donc faux en release ; Fx 149 → `true` sans condition. ESR 140 → Nightly seulement ; ESR 153 → `true`.
  - **Donc : sans geste utilisateur à partir de Fx 149 / ESR 153, geste requis avant.** Bug de suivi : https://bugzilla.mozilla.org/show_bug.cgi?id=1799344.
- ✅ **La fenêtre doit avoir le focus et ne pas être réduite**, sinon `ERROR_WIN_NOT_FOCUSED` (ext-browserAction.js:1101-1116). MDN le dit aussi : « from Firefox 149, if the window ID is for an unfocused window, the API call is rejected » (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/action/openPopup, modifiée le 2026-03-19).
- Un appel est aussi refusé si un autre panneau bloque, par exemple le menu des extensions ouvert (`isPanelShownBlockingOpenPopup`, ext-browserAction.js:92-108).
- ⚠️ La page MDN « Popups » (2025-07-17) dit encore « you can't open the popup programmatically ». Elle est **périmée** sur ce point.
- 🔎 Cas d'usage possible depuis Fx 149 : un bouton injecté dans la page LinkedIn envoie un message au background, qui appelle `action.openPopup()`. Le popup se ferme quand même au premier clic dans la page.

✅ **Interaction avec `default_popup`** : quand un popup est défini, `action.onClicked` n'est pas déclenché. Le clic ouvre le popup (« The "click" event is only dispatched when the popup is not shown », `triggerClickOrPopup`, FF/toolkit/components/extensions/ExtensionActions.sys.mjs:240-260). Pour qu'un clic sur l'icône ouvre une sidebar ou une fenêtre (§2, §3), il ne faut **pas** de `default_popup`, ou il faut le retirer par `setPopup({ popup: '' })`.

---

## 2. Sidebar `sidebar_action`

✅ **Support** : la clé de manifeste existe depuis **Fx 54**, et `open`/`close` depuis **Fx 57**. `toggle` arrive en **Fx 73**, `isOpen` en **Fx 59**, et `setPanel({ windowId })` en **Fx 61** (BCD/manifest.sidebar_action, BCD/api.sidebarAction.*). Rien ne la réserve à MV2. `browser_style` est retiré en MV3 depuis Fx 118 (BCD).

✅ **Une sidebar par fenêtre, la même pour tous les onglets** : « Each browser window can display its own sidebar, which is displayed on every tab in the window » ; « Each window gets its own instance of the document » (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/user_interface/Sidebars, modifiée le 2025-10-03).
- **Elle reste ouverte quand on change d'onglet.** Elle ne se ferme pas non plus quand on clique dans la page, et c'est ce qui rend le copier/coller possible.

✅ **Contenu propre à l'onglet** : `setPanel({ tabId, panel })` définit un panneau pour cet onglet seulement. La priorité va de l'onglet à la fenêtre, puis au global, puis au manifeste (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/sidebarAction/setPanel, 2025-07-17). Ce qui se passe au changement d'onglet est **lu dans le code**, MDN ne le dit pas :
- Sur `tab-select`, la sidebar appelle `updateWindow` (FF/browser/components/extensions/parent/ext-sidebarAction.js:122-127). Si l'URL du panneau de l'onglet diffère de l'URL affichée, `needsRefresh` passe à vrai et `SidebarController.show()` **recharge le document** (ext-sidebarAction.js:188-208 ; FF/browser/components/sidebar/browser-sidebar.js:1964-1969).
- 🔎 Donc **un panneau par onglet = rechargement du document à chaque changement d'onglet**, et perte de l'état du formulaire non sauvegardé. Si l'URL ne change pas, le document est conservé.
- 🔎 Pour garder le formulaire vivant, il vaut mieux **un seul panneau** (manifeste ou global), qui suit l'onglet actif en écoutant `tabs.onActivated` et `tabs.onUpdated`.
- 🔎 La sidebar n'écoute pas `location-change`, contrairement à `action` (§1) : un panneau posé par onglet n'est donc **pas** effacé quand l'onglet navigue.

✅ **Ouverture par programme : geste utilisateur obligatoire** :
- `open`, `close` et `toggle` portent `"requireUserInput": true` (FF/browser/components/extensions/schemas/sidebar_action.json:219-241).
- MDN : « You can only call this function from inside the handler for a user action » (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/sidebarAction/open, 2025-07-17).
- Gestes reconnus (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/User_actions, modifiée le 2026-10-08) : clic sur l'action ou la page action, menu contextuel de l'extension, raccourci clavier de l'extension (depuis Fx 63), clic sur un bouton d'une **page de l'extension**, suggestion omnibox (Fx 142).
- ⚠️ Deux limites :
  - **Un clic dans la page web transmis par un content script ne compte pas** (même page). Un bouton « Ajouter » injecté dans LinkedIn **ne peut pas** ouvrir la sidebar.
  - Le geste est **perdu après un `await`**. Il faut appeler `sidebarAction.open()` ou `toggle()` **de façon synchrone** au début du handler `action.onClicked`.
- ✅ Les appels visent toujours `windowTracker.topWindow`, la fenêtre de premier plan (ext-sidebarAction.js:450-468).
- ✅ `open_at_install` (Fx 62) ouvre la sidebar à l'installation (BCD ; ext-sidebarAction.js:129-140).
- ✅ Une commande `_execute_sidebar_action` dans `commands` donne un raccourci clavier. 🔎 Le raccourci compte comme geste (User actions).

✅ **Largeur** : **aucune API** ne la règle ; l'utilisateur la redimensionne. Valeurs CSS : `width: 18em; min-width: 14em; max-width: 75vw` (FF/browser/themes/shared/sidebar.css:5-8). Avec la nouvelle sidebar, la largeur du lanceur et celle du panneau, additionnées, sont plafonnées à 75 % de la fenêtre (browser-sidebar.js:763-788). 🔎 Le formulaire doit tenir dans environ 14em (~224 px) et s'adapter jusqu'à ~300 px.

✅ **Nouvelle sidebar (« revamp ») et onglets verticaux** :
- Le réglage `sidebar.revamp` vaut `true` en release depuis Fx 159 au plus tard (tag `FIREFOX_159_0_RELEASE`, firefox.js:2329). Il valait `false` en release jusqu'à ESR 153 inclus (Nightly seulement). Mozilla l'a pourtant déployé avant à une partie des utilisateurs de **Fx 136** par configuration distante (annonce : https://connect.mozilla.org/t5/discussions/sidebar-and-vertical-tabs-launch-in-release-136/m-p/92705). ⚠️ Le code ne permet donc pas de dater précisément « tout le monde l'a ».
- `sidebar.verticalTabs` vaut toujours `false` par défaut (firefox.js:2335 sur `main`). L'utilisateur l'active lui-même.
- ✅ **Une extension nouvellement installée est ajoutée d'office au lanceur** (`sidebar.main.tools`), puis l'extension est notée dans `sidebar.installed.extensions` pour ne pas la rajouter si l'utilisateur la retire (browser-sidebar.js:1836-1850).
- 🔎 Les onglets verticaux vivent dans le **lanceur**, et le panneau d'extension s'ouvre à côté. Les deux cohabitent, mais la largeur disponible pour la page LinkedIn diminue d'autant (plafond de 75 % ci-dessus).
- 🔎 L'ancienne sidebar (revamp désactivé) garde le même comportement d'API : le code de `sidebarAction` ne dépend pas du réglage.

✅ **Savoir quel onglet est affiché** : la sidebar se situe avec `windows.getCurrent({ populate: true })` (page Sidebars). Dans le code, `currentWindow` correspond à la fenêtre qui héberge la page appelante (FF/browser/components/extensions/parent/ext-windows.js:189-195). 🔎 Donc `tabs.query({ active: true, currentWindow: true })` depuis la sidebar renvoie bien l'onglet LinkedIn de **sa** fenêtre.

---

## 3. Fenêtre détachée `windows.create({ type: 'popup' })`

✅ **Ce que Firefox crée** :
- Tout `type` autre que `normal` devient une fenêtre « popup » (`web-extension-popup-window`).
- Elle s'ouvre avec les options `chrome,dialog,resizable,minimizable,titlebar,close,suppressinitialfullscreen`, plus `centerscreen` si ni `left` ni `top` n'est donné (FF/browser/components/extensions/parent/ext-windows.js:368-428).
- Elle n'a **pas** d'option « toujours au premier plan ».
- 🔎 Elle s'ouvre sans parent (`Services.ww.openWindow(null, …)`, :462-468). Ce n'est donc pas une fenêtre transitoire de la fenêtre LinkedIn : **elle peut passer derrière** quand l'utilisateur clique dans LinkedIn pour copier un texte, selon le gestionnaire de fenêtres.

✅ **Focus** :
- `focused: false` est accepté par le schéma mais marqué « Opening inactive windows is not supported » (FF/browser/components/extensions/schemas/windows.json:286-299). L'implémentation n'en tient pas compte (`// TODO: focused, type`, ext-windows.js:472). BCD/api.windows.create.createData.focused = false.
- **La fenêtre prend donc toujours le focus.**
- `windows.update(id, { focused: true })` la ramène au premier plan (ext-windows.js:535-537). `focused: false` n'y est pas géré non plus (:556).

✅ **Position et taille** :
- `left`, `top`, `width` et `height` sont en pixels CSS, avec un minimum de 100×100.
- La position est **ramenée dans l'écran** (`sanitizePositionParams`, ext-windows.js:14-77). Sans `left`/`top`, la fenêtre est centrée ; sinon, elle est décalée de 10 px par rapport à la fenêtre normale.
- `state` ne se combine pas avec la géométrie (:220-235).
- ⚠️ 🔎 Sous **Wayland** (Fedora par défaut), un client ne peut en général pas imposer la position de sa fenêtre. `left`/`top` risquent d'être ignorés. Non vérifié dans le code Gecko/GTK : à tester.

✅ **« Une seule à la fois »** : aucune API ne l'assure. 🔎 C'est à l'extension de le gérer :
- garder l'`id` de la fenêtre dans `storage.session` ;
- si la fenêtre existe (`windows.get`), la mettre au premier plan (`windows.update({ focused: true })`) au lieu d'en créer une autre ;
- oublier l'`id` sur `windows.onRemoved`.

✅ **Pas de geste requis** : `windows.create` ne figure pas dans la liste des API à geste (page User actions). 🔎 On peut donc l'appeler depuis un message de content script, par exemple un bouton injecté dans LinkedIn. C'est le seul des trois panneaux à le permettre sur toutes les versions.

⚠️ 🔎 **Piège « onglet actif »** :
- Depuis la fenêtre détachée, `tabs.query({ active: true, currentWindow: true })` renvoie **l'onglet de la fenêtre détachée elle-même**, car `currentWindow` est la fenêtre de la page appelante (ext-windows.js:189-195). `windows.getLastFocused()` renvoie aussi cette fenêtre quand elle a le focus.
- Il faut lui passer le `tabId` d'origine (paramètre d'URL ou `storage.session`). Pour suivre l'onglet actif d'une fenêtre normale, il faut écouter `tabs.onActivated` et filtrer `windowId`.

✅ `allowScriptsToClose` vaut vrai par défaut pour une URL `moz-extension:` (ext-windows.js:478-484) : `window.close()` fonctionne depuis la page.

---

## 4. Injection dans la page LinkedIn (content script)

✅ **Activation en MV3** : « Registered content scripts are only executed if the extension is granted host permissions for the domain ». L'utilisateur peut révoquer ces permissions après l'installation (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts, modifiée le 2026-10-08). Voir aussi la recherche 18 §2 (invite à l'installation depuis Fx 127, `permissions.contains` puis `permissions.request`).

✅ **Réseau depuis le content script en MV3 : comme la page** :
- « In MV3, fetch/XHR have the same capabilities as the web page » (FF/toolkit/components/extensions/ExtensionContent.sys.mjs:1067-1080). MDN : « host permissions don't work in content scripts ».
- ✅ La CSP renvoyée par `https://www.linkedin.com/in/…` (lue le 2026-10-29, sans être connecté, en-tête de réponse d'un HEAD) contient `connect-src 'self' *.licdn.com *.linkedin.com …`.
- 🔎 Un `fetch` vers l'API BattleCRM **depuis le content script** serait donc soumis au CORS **et** à cette CSP, donc bloqué. **Tous les appels à l'API doivent passer par le background** (`runtime.sendMessage`), comme dans le POC.

✅ **CSP de LinkedIn et éléments injectés** :
- La CSP lue autorise déjà les styles en ligne : `style-src 'self' 'unsafe-inline' static.licdn.com …`. Elle a aussi `default-src 'none'`, un `script-src` à base de hash, et un `frame-src` **sans** `moz-extension:`. ⚠️ La CSP d'une session connectée peut différer : à revérifier dans le navigateur.
- ✅ Firefox ne vérifie pas toujours un chargement d'extension contre la CSP de la page :
  - un principal étendu (celui des content scripts) **remplace la CSP du document** quand il englobe le principal du document ;
  - un principal d'extension la remplace toujours (`BasePrincipal::OverridesCSP`, FF/caps/BasePrincipal.cpp:1266-1279) ;
  - pour un style en ligne, Firefox utilise alors la CSP du principal étendu à la place de celle de la page (`nsStyleUtil::CSPAllowsInlineStyle`, FF/layout/style/nsStyleUtil.cpp:325-350).
- ✅ En MV3, la CSP du sandbox des content scripts est la « base CSP » : `script-src 'self' 'wasm-unsafe-eval';` (ExtensionContent.sys.mjs:1076-1079 ; FF/modules/libpref/init/all.js:3140). Elle ne contient **pas** de `style-src`.
- 🔎 Deux conséquences :
  - les `<style>` créés par le content script, y compris dans un shadow root, ne sont pas bloqués par LinkedIn ;
  - `adoptedStyleSheets` / `CSSStyleSheet.replaceSync`, `element.style` (CSSOM) et `content_scripts.css` (feuille d'extension) sont hors CSP de toute façon.
  - Non testé dans le navigateur ; le mécanisme ne fonctionne que si Firefox attribue bien le principal du content script à l'élément créé.

✅ **`web_accessible_resources`** :
- **Inutile pour le content script lui-même** (« content scripts don't need to be listed as web accessible resources », https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/web_accessible_resources, modifiée le 2026-08-07).
- Nécessaire pour qu'une **page web** charge une ressource de l'extension, par exemple une `<iframe src="moz-extension://…/panel.html">` ou une image référencée par URL dans le DOM de la page.
- ⚠️ MDN avertit qu'une ressource web-accessible « may be linked or redirected to by any website » et n'est « not blocked by CORS or CSP ».
- ⚠️ 🔎 L'URL contient l'UUID `moz-extension://<uuid>`, que LinkedIn peut lire dans son DOM. L'UUID est stable par profil (recherche 18 §1), ce qui donne un **identifiant de traçage**. `use_dynamic_url` n'existe pas dans Firefox (BCD/manifest.web_accessible_resources.use_dynamic_url = false).
- Le POC évitait le problème en mettant le SVG **en ligne**, et c'est la bonne approche pour le badge de recherche.

✅ **Shadow DOM pour isoler le CSS** : c'est le comportement standard de la plateforme ; le CSS de la page ne traverse pas la frontière.
- 🔎 Les **propriétés héritées** (police, couleur, `line-height`) traversent quand même, d'où `:host { all: initial }`.
- 🔎 Les unités `rem` restent relatives à la `font-size` de `<html>` de LinkedIn. Préférer `px`, ou des variables posées sur l'hôte.
- 🔎 Un shadow root `open` est lisible par les scripts de LinkedIn ; `closed` limite cet accès.
- 🔎 Cela vaut pour le badge de la recherche (petit, aucun besoin de formulaire). Un **formulaire injecté dans la page** resterait ouvert pendant le copier/coller. Mais il dépend du DOM de LinkedIn (point d'ancrage, `z-index`, re-rendus qui le retirent) et vit dans un document hostile.

⚠️ **Fragilité face aux changements du DOM** (constat du POC, rétro epic 7 § 6, et du code `content.ts`) :
- LinkedIn re-rend la liste par rafales, d'où un `MutationObserver` avec debounce ;
- il navigue en SPA, d'où la Navigation API (Fx 126+ selon le commentaire du POC, non revérifié ici) avec le `MutationObserver` en secours ;
- ses sélecteurs changent.
- 🔎 L'injection doit être **idempotente** (marqueur `data-*`) et doit **échouer en silence** : pas de badge plutôt qu'un badge faux.

✅ **Messages** :
- content script → background : `runtime.sendMessage` / `runtime.connect` ;
- background ou page d'extension → content script : `tabs.sendMessage(tabId, …)` / `tabs.connect` (page Content scripts).

---

## 5. Pour chaque surface : URL de l'onglet, lien avec le background, permissions

✅ **Lire `tab.url`** : la propriété est renvoyée si l'extension a la permission `tabs`, **ou** `activeTab` accordé pour cet onglet, **ou** une host permission qui correspond à l'URL de l'onglet (`hasTabPermission` / `matchesHostPermission`, FF/toolkit/components/extensions/parent/ext-tabs-base.js:194-228, 255-259).
- 🔎 **`host_permissions: ["*://www.linkedin.com/*"]` suffit** pour lire l'URL des onglets LinkedIn. La permission `tabs`, qui affiche « Accéder aux onglets du navigateur » à l'installation, est **inutile** ici. Le filtre `tabs.onUpdated({ urls })` exige lui aussi `hasTabPermission` (FF/browser/components/extensions/parent/ext-tabs.js:314-316).
- ✅ `activeTab` est accordé au clic sur l'action (et temporairement au préchargement du popup, ExtensionActions.sys.mjs:206-248). 🔎 Inutile si l'on a la host permission LinkedIn.
- ✅ `scripting` sert seulement à `scripting.executeScript/insertCSS/registerContentScripts` (Fx 102+, page Content scripts). 🔎 Inutile avec un `content_scripts` déclaré dans le manifeste.

✅ **Le background en Firefox MV3 est une event page** (`background.scripts`), pas un service worker : `background.service_worker` n'est pas supporté (BCD/manifest.background.service_worker = false). Réglage verrouillé à `false` dans les builds sans WebIDL WebExtensions (FF/modules/libpref/init/all.js:1755-1758).

| Surface | URL du profil de l'onglet actif | Lien avec le background | Geste requis pour l'ouvrir | Survit à un clic dans la page | Permissions minimales |
|---|---|---|---|---|---|
| Popup `action` | 🔎 `tabs.query({active, currentWindow})` → bon onglet | `runtime.sendMessage` ; `tabs.sendMessage` vers le content script | Clic ou raccourci ; `openPopup()` sans geste dès Fx 149, fenêtre ayant le focus | ❌ se ferme | host LinkedIn |
| Sidebar | 🔎 `tabs.query({active, currentWindow})` → onglet de sa fenêtre ; suivre `tabs.onActivated`/`onUpdated` | idem | **Oui, toujours** (clic sur l'action, menu, raccourci, page d'extension), appel synchrone | ✅ | host LinkedIn |
| Fenêtre détachée | ⚠️ `currentWindow` = elle-même → lui **passer le `tabId`** d'origine | idem | Non | 🔎 oui, mais peut passer derrière | host LinkedIn |
| Content script | `location.href` + détection SPA | `runtime.sendMessage` ; ⚠️ pas de `fetch` direct vers l'API en MV3 | — (injecté d'office) | ✅ (dans la page) | host LinkedIn |

---

## Conséquence pratique (déduction)

- **(c) Badge de recherche** → content script, badge en ligne (SVG + style CSSOM, ou Shadow DOM), API via le background. Rien de nouveau par rapport au POC.
- **(a) Présence sur un profil** → badge `action` **par onglet** (`tabId`). ⚠️ Il faut l'effacer ou le recalculer soi-même à chaque navigation SPA (pushState ne le remet pas à zéro). La sidebar n'a pas de badge.
- **(b) Formulaire ouvert pendant le copier/coller** → la **sidebar** est la seule surface native qui reste visible au clic dans la page, sans dépendre du DOM de LinkedIn.
  - Prix : ouverture **uniquement par geste** (clic sur l'action sans `default_popup`, raccourci ou menu, avec `sidebarAction.toggle()` appelé avant tout `await`) ; un **seul panneau**, qui suit l'onglet actif, pour ne pas recharger le document ; largeur choisie par l'utilisateur, au moins ~224 px.
  - Le popup oblige à rouvrir sans cesse (le POC compensait avec `storage.session`). La fenêtre détachée passe derrière et ne sait pas seule à quel onglet elle appartient.

## À trancher par un vrai test dans Firefox

1. **Sidebar** :
   - `action.onClicked` → `sidebarAction.toggle()` depuis une **event page MV3** réveillée par le clic : le geste est-il bien conservé au premier clic après une mise en veille du background ?
   - Le document survit-il au changement d'onglet, avec panneau unique et revamp activé comme désactivé ?
2. **Fenêtre détachée sous Wayland (Fedora)** : `left`/`top` sont-ils respectés ? Passe-t-elle derrière la fenêtre principale quand on clique dans LinkedIn ?
3. **CSP de LinkedIn connecté** : relire l'en-tête réel. Vérifier qu'un `<style>` dans un shadow root créé par le content script n'est pas bloqué (console CSP).
4. **Badge `action` et SPA** : confirmer qu'un passage de profil à profil par pushState conserve le badge par onglet, et qu'un rechargement complet l'efface.
5. **`openPopup()` sans geste** (Fx ≥ 149) depuis un message de content script : vérifier qu'il s'ouvre quand la fenêtre a le focus, et qu'il se ferme au clic suivant dans la page.
