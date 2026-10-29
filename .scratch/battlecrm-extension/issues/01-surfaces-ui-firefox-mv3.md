# Surfaces d'interface d'une extension Firefox MV3

Type: research
Status: resolved
Blocked by:

## Question

Que permet chaque surface d'interface d'une extension Firefox MV3, et avec quelles limites, pour afficher la présence d'un Contact sur un profil LinkedIn et le formulaire d'ajout ?

- **Popup `browser.action`** : fermeture au clic extérieur, taille maximale, badge et titre par onglet (`setBadgeText({ tabId })`), ouverture par programme (`action.openPopup`).
- **Sidebar `sidebar_action`** : reste-t-elle ouverte en changeant d'onglet ? Peut-elle afficher un contenu propre à l'onglet (`sidebarAction.setPanel({ tabId })`) ? Ouverture par programme (geste utilisateur requis ?), largeur, cohabitation avec la sidebar native de Firefox (nouvelle sidebar, onglets verticaux).
- **Fenêtre détachée** `windows.create({ type: 'popup' })` (choix du POC) : focus, position, une seule à la fois.
- **Injection dans la page LinkedIn** (content script) : Shadow DOM pour isoler le CSS, CSP de LinkedIn, `web_accessible_resources`, risque quand le DOM change.
- Pour chaque surface : comment elle apprend l'URL du profil de l'onglet actif et parle au background, et quelles permissions elle exige (`tabs`, `activeTab`, `scripting`).

Sources de confiance : MDN WebExtensions, code source de Firefox, blog Mozilla Add-ons. Noter la version de Firefox à partir de laquelle chaque fait vaut. Résultats dans `../research/01-surfaces-ui-firefox-mv3.md`.

## Answer

Détail et sources : [research/01-surfaces-ui-firefox-mv3.md](../research/01-surfaces-ui-firefox-mv3.md) (Firefox `main` @ `bf754717`, 2026-10-29 ; release 159, ESR 153.6).

- **Popup `action`** : se ferme au premier clic dans la page (le copier-coller est donc impossible), 800×600 au plus. Badge, titre et icône par onglet (Fx 109+), mais un `pushState` de LinkedIn garde l'ancien badge : l'extension doit le recalculer. `openPopup()` sans geste depuis Fx 149 / ESR 153. Le POC, depuis `c066b11` (2026-04-21), utilisait ce popup et gardait le formulaire dans `storage.session`.
- **Sidebar** : une par fenêtre. Elle reste ouverte en changeant d'onglet et en cliquant dans la page : c'est la seule surface native qui permet de copier-coller avec le formulaire ouvert. Pas de badge (la présence passe donc par le badge `action`). `open`/`toggle` exigent toujours un geste, appelé de façon synchrone dans `action.onClicked`, sans `default_popup`. Préférer un seul panneau qui suit l'onglet actif plutôt que `setPanel({ tabId })`. Largeur non réglable (14em à 75vw).
- **Fenêtre détachée** : prend toujours le focus, ne reste pas au premier plan et peut passer derrière LinkedIn ; plusieurs possibles si l'extension ne les gère pas ; `currentWindow` désigne la fenêtre elle-même.
- **Content script** : son `fetch` est soumis à la CSP et au CORS de LinkedIn, donc tout passe par le background. Les styles injectés relèvent de la CSP de l'extension. Ne référencer aucune ressource par URL (sinon fuite de l'UUID), SVG en ligne.
- **Permissions** : la host permission LinkedIn suffit ; `tabs`, `activeTab` et `scripting` sont inutiles avec un content script déclaré. Le background est une event page.
- Six points à vérifier dans un vrai Firefox : reportés au ticket [Où vit l'interface et ce qu'elle montre](06-surfaces-et-gestes.md).

## Comments

- 2026-10-29 : résolu par un agent de recherche.
