# 04: Squelette de l'extension : se connecter depuis Firefox

**What to build:** l'extension se lance en dev dans Firefox. Un clic sur l'icône ouvre et ferme la sidebar, qui suit l'onglet actif. On s'y connecte (e-mail et mot de passe, puis code du second facteur ou code de secours) et s'y déconnecte. Elle montre les écrans « Ta session a expiré » (e-mail rempli), « Extension à mettre à jour » (`426`), « BattleCRM ne répond pas » avec « Réessayer », et ailleurs « Ouvre un profil LinkedIn pour voir ou ajouter un Contact. ». Sources : [spec extension](../../battlecrm-extension/spec.md) §2, §3, §9, §10, §13 (A4 à A7), §16 ; ST-110, ST-111, ST-115, ST-116, ST-121, ST-122, ST-123.

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] Workspace `apps/extension` en WXT épinglé (`imports: false`, plugins Vite du catalog), dans `pnpm check` (`wxt prepare` avant `tsc -b`, `references` racine) ; `pnpm build` produit le build Firefox
- [ ] Manifeste : MV3, Firefox ≥ 140, `data_collection_permissions: none`, `gecko.id` `battlecrm@<domaine>`, `host_permissions` LinkedIn et origine de l'app (passée au build, `localhost` en dev), ni `tabs` ni `activeTab` ni `scripting` ; `update_url` prévu
- [ ] `sidebarAction.toggle()` appelé de façon synchrone dans `action.onClicked`, sans popup
- [ ] Background (event page) seul détenteur du client `hc<AppType>` (Bearer, `X-Client`, `credentials: 'omit'`), du jeton (`storage.local`, relu au réveil) et du traitement de `401`, `426`, erreurs réseau ; messages en union discriminée écrite à la main avec `send()`
- [ ] Sidebar en React, React Aria, Tailwind, thème et `@battlecrm/ui` ; TanStack Query sur `send()` ; langue du navigateur (`fr`, `en` à défaut) ; thème du système ; écrans par ordre de priorité (spec §3) ; « Se déconnecter » dans le pied, sans confirmation, qui révoque la session et efface le jeton
- [ ] Projet Vitest `extension` : instance Chromium pour la sidebar avec un faux background au niveau de `send()`, instance Firefox prête pour la lecture de LinkedIn ; axe sur chaque écran, deux thèmes ; CI et `CLAUDE.md` en `playwright install chromium firefox`
- [ ] Dev : `pnpm --filter @battlecrm/extension dev` sur `localhost`, profil Firefox persistant dans un `web-ext.config.ts` git-ignoré
