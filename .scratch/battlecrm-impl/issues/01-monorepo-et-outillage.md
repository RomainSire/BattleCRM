# 01: Monorepo et outillage

**What to build:** un monorepo pnpm vide mais complet, où `pnpm check` (format, lint, types, tests) passe en local et en CI, et où les interdictions d'architecture sont déjà outillées avant la première ligne de code métier. Sources : spec stack §2, §13 ; ADR 0008, 0014.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] pnpm seul, `packageManager` épinglé, catalogs pour toute dépendance partagée, `minimumReleaseAge` 7 jours, liste blanche des scripts d'installation
- [ ] Workspaces `@battlecrm/*` en source seule : `apps/web`, `apps/api`, `packages/domain`, `packages/contract`, `packages/theme`, `packages/i18n` (`apps/site` et `apps/extension` ne sont pas créés)
- [ ] TypeScript 7 (`tsgo -b`) avec la config de base et toutes les options strictes de la spec stack §2
- [ ] Oxlint en mode typé, Prettier + plugin Tailwind ; `pnpm check` lance format, lint, types et tests (Vitest 4 en projets `domain`, `api`, `web`)
- [ ] Interdictions outillées et prouvées par un fichier fautif qui fait échouer `pnpm check` : import profond d'un autre module de l'API, paquets bannis (avec l'alternative dans le message), `packages/domain` sans dépendance ni DOM, `crypto`/`performance` interdits dans `domain` (`Date.now`/`Math.random` si Oxlint le permet, sinon noté en revue)
- [ ] Workflow CI `ci` sur push et PR : install, `prettier --check`, `oxlint --type-aware`, `tsgo -b`, tests, build, tout bloquant
- [ ] Renovate configuré (hebdomadaire, groupé, Actions épinglées par SHA, Drizzle / Better Auth / `postgres` en PR manuelle)
- [ ] Vérifié et noté dans le ticket : Oxlint propose-t-il `no-restricted-properties` nativement (spec stack §15)
