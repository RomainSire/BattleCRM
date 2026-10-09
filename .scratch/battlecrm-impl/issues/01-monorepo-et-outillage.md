# 01: Monorepo et outillage

**What to build:** un monorepo pnpm vide mais complet, où `pnpm check` (format, lint, types, tests) passe en local et en CI, et où les interdictions d'architecture sont déjà outillées avant la première ligne de code métier. Sources : spec stack §2, §13 ; ADR 0008, 0014.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] pnpm seul, `packageManager` épinglé, catalogs pour toute dépendance partagée, `minimumReleaseAge` 7 jours, liste blanche des scripts d'installation
- [x] Workspaces `@battlecrm/*` en source seule : `apps/web`, `apps/api`, `packages/domain`, `packages/contract`, `packages/theme`, `packages/i18n` (`apps/site` et `apps/extension` ne sont pas créés)
- [x] TypeScript 7 (`tsgo -b`) avec la config de base et toutes les options strictes de la spec stack §2
- [x] Oxlint en mode typé, Prettier + plugin Tailwind ; `pnpm check` lance format, lint, types et tests (Vitest 4 en projets `domain`, `api`, `web`)
- [x] Interdictions outillées et prouvées par un fichier fautif qui fait échouer `pnpm check` : import profond d'un autre module de l'API, paquets bannis (avec l'alternative dans le message), `packages/domain` sans dépendance ni DOM, `crypto`/`performance` interdits dans `domain` (`Date.now`/`Math.random` si Oxlint le permet, sinon noté en revue)
- [x] Workflow CI `ci` sur push et PR : install, `prettier --check`, `oxlint --type-aware`, `tsgo -b`, tests, build, tout bloquant
- [x] Renovate configuré (hebdomadaire, groupé, Actions épinglées par SHA, Drizzle / Better Auth / `postgres` en PR manuelle)
- [x] Vérifié et noté dans le ticket : Oxlint propose-t-il `no-restricted-properties` nativement (spec stack §15)

## Comments

**2026-10-09, implémentation (agent).**

- **`no-restricted-properties` existe nativement dans Oxlint** (1.86) : `Date.now` et `Math.random` sont donc interdits par le lint dans `packages/domain`, plus besoin de revue pour eux (spec stack §15 levé). `new Date()` sans argument reste en revue.
- **TypeScript 7.0 stable s'installe par le paquet `typescript`** (7.0.2) et son binaire s'appelle `tsc`, pas `tsgo` : les scripts et la CI lancent `tsc -b` (spec stack §2 et §10.3 mises à jour, §15 coché).
- **Vitest 4.1.11** comme le dit la spec, alors que Vitest 5 est sorti le 2026-09-03 : la montée viendra par Renovate (majeure, PR à part).
- **pnpm 12.8.2** épinglé (la plus récente de plus de 7 jours) ; réglages dans `pnpm-workspace.yaml` (`minimumReleaseAge: 10080`, `allowBuilds: {}` vide car aucune dépendance n'a besoin de script, `strictDepBuilds`). pnpm 12 refuse une clé inconnue dans ce fichier, une faute de frappe ne désactive donc pas la garde en silence.
- **Oxlint, pièges notés dans `.oxlintrc.json`** : une `override` remplace les options d'une règle au lieu de les fusionner (l'override de l'API répète la liste des paquets bannis) ; un `regex` avec lookahead ne correspond à rien, sans erreur, d'où des motifs `group` (globs gitignore avec `!…/index.ts`).
- **Import profond** : une seule override sur `apps/api/src/**` liste les dix modules de la spec §5.2 ; un module ne nomme jamais son propre dossier dans ses imports relatifs. Les globs `.*/**/<module>/**` ne visent que les chemins relatifs (jamais un sous-chemin de paquet comme `@x/db/client`) ; seule limite connue, un sous-dossier d'un module ne doit pas porter le nom d'un autre module. Un nouveau module s'ajoute à cette liste. L'exception « `views` lit les `tables.ts` des autres modules, sauf `auth` » et la restriction de `withoutIsolation` viendront avec le ticket 02.
- **Preuve par fichiers fautifs** (retirés ensuite) : `pnpm check` échoue sur `../battles/internal.ts` depuis `prospecting` (`../battles/index.ts` passe), `sonner`, `@radix-ui/react-dialog`, `@prisma/client` dans l'API, `node:fs` et `zod` dans `domain`, `crypto`, `performance` (aussi par `globalThis.`), `Date.now`, `Math.random` (lint), et `document`, `process`, `fetch` (types : `lib: ["ES2024"]`, `types: []`).
- **Scripts racine** : `check`, `lint`, `typecheck` et `test` tournent une fois depuis la racine (projets Vitest, références `tsc -b`, Oxlint sur tout le dépôt) ; seul `build` est récursif.
- **Tests `web`** en mode navigateur sur Chromium : en local, une fois, `pnpm exec playwright install chromium` ; la CI l'installe à chaque exécution.
- **CI** : Actions épinglées par SHA à des versions de plus de 7 jours (`setup-node` v7.0.0, la v7.1.0 a un jour). `pnpm build` ne fait rien tant qu'aucun workspace n'a de script `build`.
