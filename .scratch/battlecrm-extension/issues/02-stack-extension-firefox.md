# Outillage d'une extension Firefox MV3 en 2026

Type: research
Status: resolved
Blocked by:

## Question

Quels faits faut-il connaître pour choisir la stack de `apps/extension` dans le monorepo V2 (pnpm, Vite, TypeScript 7, oxlint, Prettier, Vitest en mode navigateur, React 19 + React Aria + `packages/theme` en Tailwind) ?

- **Build** : WXT (état, maintenance, compatibilité avec Vite 8 et TS 7, ce qu'il apporte) face à Vite + `web-ext` seuls (ou `@samrum/vite-plugin-web-extension` et équivalents). Le background MV3 de Firefox est une event page, pas un service worker : quel effet sur le code ?
- **UI** : React + React Aria + Tailwind dans une page d'extension (popup ou sidebar) ; dans un content script, coût d'injecter React et Tailwind dans un Shadow DOM, face à du DOM natif pour une simple pastille.
- **Tests** : Vitest sur des fixtures HTML (jsdom ou mode navigateur) ; tests de bout en bout d'une extension **dans Firefox** (Playwright + Firefox ne charge pas d'extension : quelles alternatives ? `web-ext run` + Marionette, Selenium/geckodriver `installAddon`, Puppeteer Firefox WebDriver BiDi `webExtension.install`).
- **Signature et livraison** : `web-ext sign` (canal `unlisted`) en CI, durée, secrets AMO, obligation de version croissante, `data_collection_permissions`, mises à jour automatiques auto-hébergées (`update_url`) d'un `.xpi` non listé.
- **Client API** : `hc<AppType>` de Hono depuis une page d'extension avec `Authorization: Bearer` et `credentials: 'omit'`.

Résultats dans `../research/02-stack-extension-firefox.md`, versions lues datées.

## Answer

Détail et sources : [research/02-stack-extension-firefox.md](../research/02-stack-extension-firefox.md) (2026-10-29, essais dans un bac à sable avec Firefox 158).

- **Build** : WXT reste le seul outil vivant qui couvre Firefox. Il est en 0.x (chaque mineure casse). La 0.21.5 sort tout juste : `minimumReleaseAge` installera donc la 0.21.4. Depuis la 0.21, `vite`, `typescript` et `web-ext` sont des peers, donc le catalog V2 s'applique. WXT 0.21 + Vite 8.3 + TS 7.0 construit et passe `tsc` en mode strict. Coûts : `.wxt/` généré doit exister avant `tsc -b`, et les types `browser` viennent de `@types/chrome` (sans les API propres à Firefox). `@samrum` est abandonné, `vite-plugin-web-extension` déprécié, CRXJS partiel pour Firefox.
- **Background** : event page seulement (pas de service worker en MV3 Firefox), avec le DOM. Elle s'arrête après 30 s d'inactivité : écouteurs enregistrés de façon synchrone, jeton relu depuis `storage` à chaque réveil.
- **UI** : React 19 fonctionne dans une page d'extension. Pour une pastille injectée, le DOM natif pèse 1,4 kB gzip, contre 72 kB pour React + Tailwind en Shadow DOM. Le Shadow DOM de React Aria est expérimental (drapeau privé), et les `rem` ne sont pas isolés de la page.
- **Tests** :
  - jsdom 30 n'a pas `innerText`. Le scraping se teste en Vitest mode navigateur avec le Firefox de Playwright, sur des fixtures injectées. `WxtVitest()` casse dans ce mode.
  - Playwright ne charge pas d'extension Firefox (« hors périmètre »). Puppeteer `installExtension` (BiDi, Fx ≥ 137) fonctionne, mais ni la vraie popup ni la sidebar ne sont atteignables, et `moz-extension://` exige `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1` depuis Fx 153 : bout en bout fragile.
  - L'image `ubuntu-24.04` des GitHub Actions fournit Firefox 158.
- **Signature** :
  - `web-ext sign --channel unlisted`, secrets `WEB_EXT_API_KEY`/`WEB_EXT_API_SECRET`.
  - AMO refuse à jamais une version déjà envoyée : relancer la livraison d'un tag doit sauter la signature.
  - Aucun suffixe de version (`0.8.0-rc.1` refusé).
  - `data_collection_permissions: none` est obligatoire et demande Fx ≥ 140.
  - Le POC n'avait pas d'`update_url`.
- **Client API** : `hc` avec `headers` asynchrone (Bearer, `X-Client`) et `init: { credentials: 'omit' }` fonctionne. Piège : des `headers` dans `init` remplacent tout, `content-type` compris.
- Confirmé dans Firefox 158 (complète research/18) : un POST du background en Bearer porte `Origin: moz-extension://<uuid>` et `Sec-Fetch-Site: same-origin` ; un GET ne porte pas `Origin`.

## Comments

- 2026-10-29 : résolu par un agent de recherche.
