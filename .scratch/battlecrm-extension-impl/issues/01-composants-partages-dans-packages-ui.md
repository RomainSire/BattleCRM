# 01: Composants partagés dans `packages/ui`

**What to build:** les primitives d'interface de la SPA qui ne dépendent pas d'elle (boutons, champs, combobox, commande segmentée, toast…) vivent dans un nouveau paquet `@battlecrm/ui`, prêtes pour la sidebar de l'extension. La SPA fonctionne exactement comme avant. Sources : [spec extension](../../battlecrm-extension/spec.md) §9 ; ST-120.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Les primitives sont **déplacées**, sans copie : la SPA les importe depuis `@battlecrm/ui`
- [x] `OfflineNote` et `GesturePanel` (qui dépendent de l'état en ligne de la SPA) restent dans la SPA ; rien de propre à la SPA dans le nouveau paquet
- [x] Paquet source seule, comme les autres `packages/*` ; les classes Tailwind du paquet sont bien générées dans la SPA
- [x] `pnpm check` passe, tests de la SPA et e2e inchangés

## Comments

**2026-10-30, implémentation (agent).**

- **Déplacement** par `git mv` de 16 primitives vers `packages/ui/src` (bouton, case à cocher, combobox, dialogue, message d'erreur, champ, groupe de saisie, saisie, libellé, menu, commande segmentée, séparateur, table, zone de texte, toast, infobulle). Un seul point d'entrée `@battlecrm/ui` (`src/index.ts`) ; ~70 fichiers de la SPA l'importent. `apps/web/src/components/ui` ne garde que `GesturePanel` et `OfflineNote`.
- **`Button` ne lit plus l'état en ligne de la SPA** : `OnlineContext` (`packages/ui/src/online.ts`), fourni par `OnlineProvider` dans `App` depuis `useIsOnline()`. Par défaut **hors ligne** : un fournisseur oublié (dans la sidebar par exemple) désactive aussitôt les boutons qui enregistrent, sans jamais laisser passer une sauvegarde (ADR 0004). La sidebar devra fournir le sien.
- **Styles** : `@battlecrm/ui/ui.css`, importé par `index.css` après le thème, déclare `@source './'` (Tailwind génère les classes du paquet), importe `tw-animate-css` et porte la règle de focus du groupe de saisie, sortie de `index.css`. Le CSS de la SPA buildée contient exactement les mêmes règles qu'avant (seul l'ordre des `@property` de `tw-animate-css` change).
- **Dépendances** : `class-variance-authority` et `tw-animate-css` passent de la SPA au paquet ; `react` et `react-aria-components` en peer. `packages/ui` entre dans les `references` du `tsconfig.json` racine.
- **Docs** : chemin de `ErrorMessage` mis à jour dans `CODING_STANDARDS.md` ; ligne `packages/ui` ajoutée au tableau des workspaces de la spec stack.
- **Vérifié** : `pnpm check` (1162 tests), e2e 32/32. Un premier passage e2e a eu un dépassement de délai Firefox sur `/sign-in` pendant qu'une autre suite tournait en parallèle ; repassé seul, vert.
