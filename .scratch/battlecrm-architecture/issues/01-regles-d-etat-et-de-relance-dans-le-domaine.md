# 01: Les règles d'État et de Relance vivent dans le paquet domaine

**What to build:** les règles qui se calculent sur l'État d'un Contact et sa Relance sont écrites une seule fois, dans le paquet des règles pures partagées. L'API et la SPA appellent les mêmes fonctions, comme le prévoit l'ADR 0012. Aujourd'hui, elles sont réécrites des deux côtés. Côté SPA, elles sont exportées par des écrans de plusieurs centaines de lignes qui s'importent en chaîne : la fiche Contact importe les Interactions, qui importent le changement d'État, qui importe la Relance. C'est une préparation : elle passe avant le reste du chantier, car elle touche les mêmes fichiers que les tickets 02 et 06. Aucun comportement visible ne change. Sources : revue d'architecture du 2026-10-15 (piste 4) ; ADR 0012 ; CONTEXT (État, Relance, Vivier, Archivé, Entrée dans le Funnel).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] « Seuls un Contact En prospection et un Allié ont une Relance » : une seule fonction du domaine, appelée par l'API et la SPA
- [x] « Vivier ou Archivé : hors du Funnel » : une seule fonction du domaine, appelée par l'API et la SPA
- [x] « Quitter En prospection annule la Relance planifiée » : une seule fonction du domaine. L'API l'applique, le récapitulatif de la SPA l'annonce
- [x] L'Étape d'entrée d'un Contact qui revient En prospection et le test « cette Étape est-elle dans le Funnel » sont calculés par le domaine
- [x] Les écarts de jours de l'API (date passée, date future) passent par l'arithmétique de jours du domaine, plus par un calcul local
- [x] Le jour local, « la Relance est-elle due ? » et « ce Contact peut-il avoir une Relance ? » ne sont plus exportés par un écran
- [x] Les libellés de Canal sortent de l'écran Interactions et vivent dans un module de la SPA que l'atelier des Positionnements importe
- [x] Plus aucun écran Contact n'importe un autre écran Contact pour une règle
- [x] Tests unitaires du domaine pour chaque règle déplacée ; les tests existants de l'API et de la SPA restent verts sans modification de comportement
- [x] `pnpm check` vert

## Comments

**2026-10-15, implémentation (agent), notée après coup depuis le commit 8cd1ba9.**

- **Paquet domaine** : `status.ts` (`hasFollowUps`, `isPoolOrArchived`, `statusChangeCancelsFollowUp`, `canNoteInteraction`), `funnel.ts` (`funnelOf`, `isInFunnel`, `stageToEnter`), `daysBetween` dans `days.ts`, `isFollowUpDue` dans `follow-up.ts`. Chacune a ses tests unitaires.
- **API** (`prospecting/index.ts`) : les refus et l'inverse d'un changement d'État appellent ces fonctions. L'instant d'une Interaction datée d'un jour passé se calcule par `daysBetween`. Les refus `past_day` et `future_day` comparent toujours les jours ISO entre eux, sans arithmétique locale.
- **SPA** : `todayOf` passe dans `summary.ts` et `CHANNEL_LABEL` dans `channel.ts`, que l'atelier des Positionnements importe. `change-status.tsx` n'importe plus `follow-up.tsx`.
- **Reste, sans règle** : `interactions.tsx` importe encore de `follow-up.tsx` et `change-status.tsx` des morceaux d'UI partagés (champs, récapitulatifs, `settle`). C'est hors du périmètre « pour une règle », le ticket 07 pourra les regrouper.
