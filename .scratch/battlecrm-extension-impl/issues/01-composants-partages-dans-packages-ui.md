# 01: Composants partagés dans `packages/ui`

**What to build:** les primitives d'interface de la SPA qui ne dépendent pas d'elle (boutons, champs, combobox, commande segmentée, toast…) vivent dans un nouveau paquet `@battlecrm/ui`, prêtes pour la sidebar de l'extension. La SPA fonctionne exactement comme avant. Sources : [spec extension](../../battlecrm-extension/spec.md) §9 ; ST-120.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Les primitives sont **déplacées**, sans copie : la SPA les importe depuis `@battlecrm/ui`
- [ ] `OfflineNote` et `GesturePanel` (qui dépendent de l'état en ligne de la SPA) restent dans la SPA ; rien de propre à la SPA dans le nouveau paquet
- [ ] Paquet source seule, comme les autres `packages/*` ; les classes Tailwind du paquet sont bien générées dans la SPA
- [ ] `pnpm check` passe, tests de la SPA et e2e inchangés
