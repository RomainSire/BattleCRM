 ---
  Plan de mise à jour BattleCRM — Définitif

  ---
  Phase 1 — Patches & mineurs 🟢 (~15 min) ✅ DONE (2026-04-15)

  Aucun breaking change, une commande :

  pnpm up react-router wxt @swc/core @types/node --recursive

  ▎ Note : hot-hook est déjà à la version la plus récente (0.4.0). Rien à faire.

  Vérification : pnpm type-check && pnpm test
  ✅ type-check : OK (shared, backend, frontend, extension)
  ✅ tests backend : 269/269 passed

  ---
  Phase 2 — VineJS 3 → 4 🟡 (~1h) ✅ DONE (2026-04-15)

  Breaking changes à corriger manuellement :

  ┌───────────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────┐
  │                                          Change                                           │               Où chercher                │
  ├───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
  │ vine.file() → vine.nativeFile()                                                           │ apps/backend/app/validators/             │
  ├───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
  │ confirmed rule : l'erreur remonte sur password_confirmation (plus sur password)           │ validators auth + frontend error display │
  ├───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
  │ .positive() / .negative() : 0 échoue désormais → utiliser .nonNegative() / .nonPositive() │ tous les validators number               │
  ├───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
  │ confirmationField: 'x' → as: 'x'                                                          │ validators avec champ de confirmation    │
  ├───────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────┤
  │ BaseModifiers supprimé                                                                    │ peu probable, mais grep                  │
  └───────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────┘

  Upgrade : pnpm up @vinejs/vine@4 --recursive  ← @4 requis (saut majeur, semver ne passe pas)

  Vérification : pnpm test (unit + functional backend), pnpm type-check
  ✅ Aucun breaking change dans le code (vine.file, .positive/.negative, confirmationField, BaseModifiers → non utilisés)
  ✅ @vinejs/vine → 4.3.1
  ✅ type-check : OK
  ✅ tests backend : 269/269 passed

  ---
  Phase 3 — i18next 25 → 26 + react-i18next 16 → 17 🟡 (~30 min)

  Ces deux packages vont ensemble (react-i18next v17 exige i18next v26 comme peer dep).

  Breaking changes :

  ┌────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────┐
  │                                                 Change                                                 │                  Impact BattleCRM                  │
  ├────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ initImmediate supprimé → initAsync                                                                     │ Vérifier apps/frontend/src/i18n.ts et              │
  │                                                                                                        │ apps/extension/                                    │
  ├────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ Format d'interpolation legacy supprimé : interpolation: { format: (value, format, lng) => ... }        │ Vérifier les fichiers i18n init                    │
  ├────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ showSupportNotice / simplifyPluralSuffix supprimés                                                     │ Juste supprimer si présents                        │
  ├────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────┤
  │ <Trans> sans i18nKey explicite : les clés auto-générées changent si des tags HTML wrappent des         │ Auditer tous les <Trans> sans i18nKey              │
  │ interpolations                                                                                         │                                                    │
  └────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────┘

  Upgrade : pnpm up i18next react-i18next --recursive

  Vérification : pnpm type-check + test visuel des traductions

  ---
  Phase 4 — lucide-react 0.x → 1.x 🟢 (~10 min)

  Bonne nouvelle : Aucun des icônes utilisés dans BattleCRM n'est un brand icon supprimé. Les 14 icônes supprimées (Github, Slack, Facebook, etc.) ne sont pas
  utilisées.

  Seul changement potentiel : aria-hidden="true" ajouté par défaut sur tous les icônes décoratifs (positif pour l'accessibilité).

  Upgrade : pnpm up lucide-react --filter @battlecrm/frontend

  Vérification : pnpm type-check (TypeScript détectera immédiatement tout icône manquant)

  ---
  Phase 5 — Vite 8 + @vitejs/plugin-react 6 🟡 (~1h)

  Architecture : Rolldown (Rust) remplace esbuild+Rollup. Une compat layer automatique existe.

  Breaking changes pour BattleCRM :

  ┌────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────┐
  │                                 Change                                 │                                Impact                                │
  ├────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ build.rollupOptions → build.rolldownOptions                            │ Probablement non utilisé → vérifier vite.config.ts                   │
  ├────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ esbuild config option déprécié → oxc                                   │ Probablement non utilisé                                             │
  ├────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Babel complètement supprimé de @vitejs/plugin-react                    │ Si react({ babel: ... }) → migrer vers @rolldown/plugin-babel séparé │
  ├────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ CJS interop légèrement différent                                       │ Vérifier imports CJS                                                 │
  ├────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┤
  │ Cibles navigateurs remontées (Chrome 111+, Firefox 114+, Safari 16.4+) │ Acceptable pour une app pro                                          │
  └────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────┘

  En pratique pour ce projet : probablement juste un bump de version.

  Upgrade : pnpm up vite @vitejs/plugin-react --filter @battlecrm/frontend

  Vérification : pnpm build (frontend) + pnpm dev + test visuel

  ---
  Phase 6 — Écosystème AdonisJS 🔴 (2-4h)

  ⚠️  Tout l'écosystème en une seule fois — les packages sont interdépendants.

  Liste des packages :
  @adonisjs/core 6→7  |  @adonisjs/auth 9→10  |  @adonisjs/lucid 21→22
  @adonisjs/session 7→8  |  @adonisjs/cors 2→3  |  @adonisjs/assembler 7→8
  @adonisjs/tsconfig 1→2  |  @japa/runner 4→5  |  @japa/plugin-adonisjs 4→5

  Breaking changes — actions manuelles requises :

  adonisrc.ts
  // Ajouter dans hooks.init :
  hooks: {
    init: [() => import('@adonisjs/core/build_hooks').then(m => m.indexEntities())],
  }
  // Supprimer : assetsBundler
  // Corriger les globs de tests : (.ts|.js) → .{ts,js}
  // Renommer les hooks assembler si présents :
  //   onBuildStarting → buildStarting
  //   onSourceFileChanged → fileChanged
  //   onDevServerStarted → devServerStarted
  //   onBuildCompleted → buildFinished

  config/app.ts + nouveau config/encryption.ts
  // Supprimer appKey de config/app.ts
  // Créer config/encryption.ts avec le driver legacy (pour décrypter les données existantes)

  package.json imports (backend)
  "#generated/*": "./.adonisjs/server/*.js",
  "#transformers/*": "./app/transformers/*.js",
  "#database/*": "./database/*.js"

  devDependencies backend
  # Supprimer : ts-node-maintained (remplacé par @poppinss/ts-exec)
  # Ajouter : youch (plus bundlé dans core)
  # Mettre à jour : ace.js pour le nouvel import

  @adonisjs/auth v10 :
  // Avant :
  withAuthFinder(() => hash.use('scrypt'))
  // Après :
  withAuthFinder(hash)

  @adonisjs/session v8 :
  // Supprimer toute référence à flash.errors → utiliser flash.inputErrors
  // (API-only, probablement pas impacté)

  Request/Response renames (uniquement dans les module augmentations) :
  // Request → HttpRequest, Response → HttpResponse

  Flash messages : flashMessages.get('errors.*') → flashMessages.get('inputErrorsBag.*')

  @japa/runner v5 : globs changent (fast-glob → fs.glob natif) — transparent en pratique.

  @japa/plugin-adonisjs v5 : nouveaux helpers swap/useFake et intégration router API client.

  Helpers supprimés à grep :
  # Chercher dans apps/backend/ :
  getDirname  getFilename  slash(  router.makeUrl  router.makeSignedUrl  cuid(

  Vérification : pnpm test (toute la suite Japa), pnpm build

  ---
  Phase 7 — TypeScript 6 🔴 (2-4h, à planifier séparément)

  ▎ ⚠️  Vérifier d'abord que AdonisJS v7 + @adonisjs/tsconfig v2 supportent TS6 avant d'attaquer cette phase.

  Un outil de migration officiel existe : npx @andrewbranch/ts5to6

  Breaking changes majeurs :

  ┌────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────┐
  │                           Change                           │                              Impact BattleCRM                              │
  ├────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
  │ strict: true par défaut                                    │ Probablement déjà activé — à vérifier                                      │
  ├────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
  │ module défaut → esnext                                     │ Backend utilise @adonisjs/tsconfig → vérifié par assembler                 │
  ├────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
  │ types: [] par défaut                                       │ Critique : ajouter "types": ["node"] explicitement dans tous les tsconfigs │
  ├────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
  │ moduleResolution: "node" déprécié → "node16" ou "bundler"  │ Frontend déjà sur "bundler" (Vite), backend à vérifier                     │
  ├────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
  │ baseUrl standalone supprimé                                │ Vérifier si utilisé dans les tsconfigs                                     │
  ├────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────┤
  │ import ... assert { type: "json" } → with { type: "json" } │ Grep dans le codebase                                                      │
  └────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────┘

  Approche : utiliser "ignoreDeprecations": "6.0" temporairement si blocage.

  ---
  shadcn CLI 3 → 4 🟢 (quand besoin)

  C'est un outil CLI de génération uniquement, pas une runtime dep. Aucune urgence. Mettre à jour quand on installe un nouveau composant. La nouveauté utile : flag
  --monorepo pour les setups pnpm.

  ---
  Récapitulatif

  ┌───────┬───────────────────────────────────────────┬────────┬────────┐
  │ Phase │                 Packages                  │ Risque │ Effort │
  ├───────┼───────────────────────────────────────────┼────────┼────────┤
  │ 1     │ react-router, wxt, @swc/core, @types/node │ 🟢     │ 15 min │
  ├───────┼───────────────────────────────────────────┼────────┼────────┤
  │ 2     │ @vinejs/vine                              │ 🟡     │ 1h     │
  ├───────┼───────────────────────────────────────────┼────────┼────────┤
  │ 3     │ i18next, react-i18next                    │ 🟡     │ 30 min │
  ├───────┼───────────────────────────────────────────┼────────┼────────┤
  │ 4     │ lucide-react                              │ 🟢     │ 10 min │
  ├───────┼───────────────────────────────────────────┼────────┼────────┤
  │ 5     │ vite, @vitejs/plugin-react                │ 🟡     │ 1h     │
  ├───────┼───────────────────────────────────────────┼────────┼────────┤
  │ 6     │ Écosystème AdonisJS (×9 packages)         │ 🔴     │ 2-4h   │
  ├───────┼───────────────────────────────────────────┼────────┼────────┤
  │ 7     │ TypeScript 6                              │ 🔴     │ 2-4h   │
  └───────┴───────────────────────────────────────────┴────────┴────────┘

  Règle d'or : un commit après chaque phase, tests verts avant de continuer.

  ---