# Stack de l'extension

Type: grilling
Status: resolved
Blocked by: 02

## Question

À partir de la recherche sur l'outillage d'une extension Firefox MV3, quelle stack pour `apps/extension` ? Build (WXT ou Vite + `web-ext`), UI des pages d'extension (React + React Aria + `packages/theme` ?), UI injectée dans LinkedIn (React en Shadow DOM ou DOM natif ?), tests unitaires et de bout en bout, place dans `pnpm check`, et ce que la stack V2 impose (TS 7, oxlint, Prettier, catalog pnpm).

## Answer

Décidé avec Romain le 2026-10-30, à partir de [Outillage d'une extension Firefox MV3 en 2026](02-stack-extension-firefox.md). Ces choix valent pour toute surface (popup, sidebar ou fenêtre : ce sont toutes des pages d'extension).

1. **Build** : WXT, **épinglé à une version exacte** (`0.21.4`, sans `^` ; mis à jour par une PR manuelle, chaque mineure 0.x pouvant casser). `imports: false` (imports explicites depuis `#imports`) ; pas de `@wxt-dev/module-react` : `vite: () => ({ plugins: [react(), tailwindcss()] })` avec les versions du catalog. `vite`, `typescript` et `web-ext` viennent du catalog. `@types/firefox-webext-browser` complète les types `browser` pour les API propres à Firefox (`sidebarAction`…).
2. **Pages d'extension** : React 19, React Aria, Tailwind 4 et `@battlecrm/theme`, comme la SPA. Pas de TanStack Router (deux ou trois écrans gérés par un état). TanStack Query garde les listes du formulaire et l'état « en cours » de l'ajout, avec des `queryFn` qui envoient un message au background au lieu d'appeler `fetch`.
3. **Composants partagés** : un nouveau `packages/ui` reçoit, **par déplacement** (sans copie), les primitives de `apps/web/src/components/ui` qui ne dépendent pas de la SPA. `OfflineNote` et `GesturePanel` (qui dépendent de `online.ts`) restent dans `apps/web`. Le formulaire d'ajout rapide n'est pas partagé : ce qu'il prête relève de « Formulaire d'ajout depuis LinkedIn ». Ce déplacement est le premier ticket d'implémentation.
4. **Messages** : une union discriminée écrite à la main (un type par geste : `lookup`, `addContact`, `signIn`…) sur `browser.runtime.sendMessage`, avec un petit helper `send()`, sans bibliothèque ni zod puisque les messages restent internes à l'extension. Seul le background détient le client `hc<AppType>`, le jeton et le traitement de `401`, `426` et `X-App-Version`.
5. **UI injectée dans LinkedIn** : DOM natif dans une racine d'ombre, avec un petit CSS écrit à la main qui reprend les quelques couleurs du thème nécessaires. Ni React ni Tailwind dans les content scripts.
6. **Langue** : `packages/i18n` (Paraglide), dans la langue du navigateur (`fr` ou `en`, `en` à défaut), sans réglage. Nom et description du manifeste écrits en dur en français, sans `_locales`.
7. **Tests** : un projet Vitest `extension` dans `vitest.config.ts`, sur deux instances : Firefox (Playwright) pour le scraping et les content scripts, Chromium pour les pages avec un faux background au niveau de `send()` (sans `WxtVitest()`). Le job CI et la note de `CLAUDE.md` passent à `playwright install chromium firefox`. **Pas de bout en bout de l'extension** : le côté API est couvert par les tests de sécurité en mode `bearer`, et une courte recette manuelle est suggérée, jamais obligatoire (corrigé le 2026-10-30).
8. **`pnpm check` et build** : un `postinstall: wxt prepare` dans `apps/extension` génère `.wxt/` avant `tsc -b`, et `apps/extension` entre dans les `references` du `tsconfig.json` racine. Oxlint et Prettier à la racine le couvrent déjà. `pnpm build` lance `wxt build -b firefox` ; zip et signature restent à la livraison.
9. **Firefox minimum** : `strict_min_version: 140.0` (`data_collection_permissions`). « Où vit l'interface et ce qu'elle montre » le relève s'il retient `openPopup()` sans geste (≥ 149).
10. **Dev** : `pnpm --filter @battlecrm/extension dev`, en dehors de `pnpm dev`, pointé sur `localhost`, avec un profil Firefox persistant dont le chemin est fixé dans un `web-ext.config.ts` git-ignoré, pour garder la session LinkedIn.

## Comments

- 2026-10-30 : **correction** de la décision 7, à la demande de Romain, dans [Quand LinkedIn change son DOM](09-quand-linkedin-change-son-dom.md) : aucune vérification manuelle n'est obligatoire à la livraison ; la recette est suggérée.
