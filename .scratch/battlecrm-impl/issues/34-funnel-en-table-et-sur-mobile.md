# 34: Funnel en table et sur mobile

**What to build:** `V` bascule le Funnel en vue table (Contact, Organisation, Cible, Étape modifiable en ligne, Essai en cours, prochaine Relance, date d'entrée dans l'Étape), triable, par urgence par défaut ; le choix est retenu par appareil. En largeur étroite, le Funnel est une liste groupée par Étape. Sources : spec UX §5.2 ; ST-55.

**Blocked by:** 33

**Status:** resolved

- [x] Table triable, urgence par défaut ; Étape modifiable en ligne via la fenêtre de conséquences ; mêmes filtres que le kanban
- [x] `V` (coupé avec les raccourcis à une touche) ; dernier choix kanban/table en `localStorage`, lu sans planter
- [x] Mobile : liste groupée par Étape, sans glisser-déposer ni table ; on change d'Étape depuis la fiche
- [x] axe sans erreur dans les deux thèmes

## Comments

**2026-10-23, implémentation (agent).**

- **API** : le résumé porte `stageEnteredOn`, jour local de la dernière entrée dans l'Étape actuelle (changement d'Étape ou entrée dans le Funnel ; `null` sans Étape). Champ ajouté (expand) ; le SPA le lit par `stageEnteredOnOf`, avec repli pour un résumé gardé sur l'appareil. Pas de migration.
- **SPA** (`apps/web/src/funnel/`) :
  - `funnel-view.ts` : kanban/table en `localStorage` (`battlecrm.funnel-view`), lu et écrit sous `try/catch`, kanban par défaut (ST-55) ;
  - sélecteur « Vue » Kanban / Table (repère `V`) et raccourci `V` par `useSingleKeyShortcuts` (coupé avec les raccourcis à une touche, jamais dans un champ ni sous une fenêtre) ; si le focus était dans la vue qui part, il passe dans la nouvelle ;
  - `funnel-table.tsx` : Table React Aria (Contact, Organisation, Cible, Étape, Essai en cours, prochaine Relance, entrée dans l'Étape), urgence par défaut, tri par colonne (vides en dernier), bouton « Trier par urgence » pour revenir à l'ordre par défaut ; Étape modifiable par un menu qui ouvre la fenêtre de conséquences ; le nom ouvre la fiche en panneau ; mêmes filtres que le kanban ;
  - `funnel-list.tsx` : en largeur étroite, une liste par Étape, par urgence ; le nom mène à la fiche en page ; les raccourcis d'action d'Aujourd'hui restent ; ni glisser ni table ni sélecteur de vue ;
  - `next-action.tsx` : texte de prochaine action (découpé en `followUpText` et `trialText`) et `CardActions`, partagés par la carte, la table et la liste ; `organizationOf` remonté dans `summary.ts`.
- **Tests** : API `change-stage.test.ts` (jour d'entrée, « Annuler », retour au Vivier puis nouvelle entrée) ; SPA `funnel-screen.test.tsx` (`V` et retour, mémoire par appareil, choix illisible ou stockage refusé, `V` coupé, `V` dans un champ, tri, Étape en ligne, filtres, axe clair et sombre pour la table et la liste mobile).
- **Revue** (standards et spec) : corrigé le test de `V` dans un champ, la garde `isFunnelView`, la recherche d'Organisation dupliquée. Laissé : le jeu de props `{ cards, summary, today, onOpen }` répété par les trois vues ; les trois façons de dire « Relance due » (table, liste, texte).
- **À trancher** :
  - « jour d'entrée dans l'Étape » et « urgence » n'ont pas d'entrée dans `CONTEXT.md` ;
  - la liste mobile garde les raccourcis d'action et le nombre de Contacts par Étape, au-delà de la lettre de la spec ;
  - en tri décroissant, les cases vides restent en dernier.
