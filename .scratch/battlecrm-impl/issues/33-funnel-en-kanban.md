# 33: Funnel en kanban

**What to build:** l'écran Funnel en kanban : une colonne par Étape non archivée, avec la Battle ouverte en en-tête, et dans chaque colonne les Contacts En prospection rangés en lignes À traiter, En attente, Sans prochaine action. L'Utilisateur change un Contact d'Étape en le glissant (souris ou clavier), ou d'État en le déposant sur les zones Vivier, Cercle et Archivé, et agit depuis la carte. Sources : spec UX §5.2 ; CONTEXT (À traiter, En attente, Sans prochaine action) ; prototype `prototype/03-vue-funnel` (C), qui ne fait pas foi sur les États ; ST-61, ST-67.

**Blocked by:** 30

**Status:** resolved

- [x] `contactAgenda(contact, today)` dans `packages/domain` (si pas déjà là) : À traiter / En attente / Sans prochaine action, avec le tri par urgence de la spec UX §5.2 ; « today » calculé avec le fuseau en vigueur du résumé, pas celui de l'appareil
- [x] En-tête : nom, But, nombre de Contacts, Battle ouverte (Champion vs Challenger, Essais sur l'Horizon) ; menu Renommer et « Gérer les Étapes… »
- [x] Carte : nom, Organisation, Cible, prochaine action, raccourcis d'action, menu `⋯` (Changer d'Étape…, Remettre au Vivier…, Ajouter au Cercle…, Archiver…, Changer d'État…, ouvrir la fiche en panneau non modal)
- [x] Glisser-déposer sur GridList + `useDragAndDrop` de React Aria, clavier compris, annoncé ; dépôt → fenêtre de conséquences (ticket 30) ou de changement d'État (ticket 19) ; pas de glisser tactile ; `E`, `S`, flèches sur une carte
- [x] Vérifié tôt : le kanban sur React Aria tient ST-61 et ST-62, sinon repli shadcn base Base UI (spec stack §15)
- [x] Filtres : nom ou Organisation, Cible, Battle, Organisation, signal ; aucun indicateur ; défilement horizontal en largeur étroite
- [x] axe sans erreur dans les deux thèmes ; parcours clavier testé en composant

## Comments

**2026-10-23, implémentation (agent).**

- **`packages/domain`** (`agenda.ts`) :
  - `contactAgenda(contact, today)` : À traiter (Relance en retard ou du jour, Essai délai dépassé), sinon En attente (Relance à venir, Essai dans les temps, Étape sans Positionnement), sinon Sans prochaine action ; une Relance planifiée passe avant l'Essai ;
  - `byUrgency` : Relance en retard la plus ancienne, du jour, délai dépassé, Sans prochaine action, puis En attente (Relances par date, Essais par fin de délai, Étapes sans Positionnement) ;
  - `isFollowUpDueIn`.
  - « today » vient de `todayOf(summary)`, le fuseau du résumé.
- **SPA** (`apps/web/src/funnel/`) :
  - route `/funnel` ; l'adresse garde le Contact, sa fiche ouverte (`panel=record`) et son geste (ST-70) ;
  - **kanban** : une GridList par Étape non archivée, les trois lignes en `GridListSection` alignées en sous-grille, défilement horizontal ;
  - **en-tête** : nom, But, nombre de Contacts (après filtres), Battle ouverte (Champion et Challenger, Essais commencés sur l'Horizon) ; son menu « Renommer » et « Gérer les Étapes… » mène à `/settings#funnel` (la section vient avec le ticket 35) ;
  - **carte** : nom, Organisation et Cible, prochaine action, raccourcis d'Aujourd'hui (Relancer…, Reporter, Annuler, A répondu… ; Sans suite…, Relancer quand même ; Utiliser un Positionnement, Planifier une Relance), menu `⋯` nommé « Actions de <Contact> » ;
  - **glisser-déposer** : dépôt sur toute la colonne (pas entre deux cartes), jamais sur sa propre Étape → fenêtre de conséquences ; zones Vivier, Cercle, Archivé (`DropZone`) pendant le glisser → fenêtre de changement d'État ; au clavier par la poignée, annoncé par React Aria ; glisser tactile bloqué au `dragstart` ;
  - **clavier** : `E`, `S`, flèches haut et bas dans la colonne, gauche et droite vers la carte la plus proche de la colonne voisine ;
  - **filtres** : nom ou Organisation, Cible, Battle (Essai en cours dans une Battle, ou Essai d'un Positionnement), Organisation, signal ; aucun indicateur.
  - **Factorisations** : `useRecordGestures` et `RecordGesturePanels` (fiche Contact), `useFollowUpQuickGestures` et `PostponeFollowUp` (Reporter, Annuler la Relance), `trialWindowOf` (délai de l'Essai lu comme la fiche) ; `MoreActions` prend un `label`.
- **Spec stack** : §15, kanban sur React Aria vérifié.
- **Tests** :
  - domaine : `agenda.test.ts` ;
  - SPA : `funnel-screen.test.tsx` (colonnes et lignes, fuseau du résumé, raccourcis, `⋯` et fiche non modale, `E`/`S`/flèches, glisser au clavier vers une Étape et vers une zone d'État, glisser à la souris puis « Annuler », menu d'en-tête, filtres, axe clair et sombre).
- **Revue** (standards et spec) :
  - corrigé :
    - menus `⋯` nommés ;
    - hauteur tactile des filtres ;
    - délai de l'Essai partagé avec la fiche ;
    - garde de « Reporter » dans le hook ;
    - ordre d'En attente ;
  - laissé :
    - type de recherche de la route recopié à la main dans `FunnelGestureSearch` ;
    - chaînes de `if` sur la raison de l'agenda dans l'écran.
- **À trancher** :
  - « conséquence d'un déplacement restée à régler » (spec UX §5.2) n'existe pas dans `CONTEXT.md` (À traiter) et n'est pas implémentée : un Essai laissé en cours après un recul compte comme tout Essai ;
  - le nombre de Contacts de l'en-tête suit les filtres ;
  - le filtre Battle propose « Essai en cours dans une Battle » ou un Positionnement, pas une Battle par Étape ;
  - le blocage du glisser tactile n'est pas testé sur un vrai appareil ;
  - pendant un glisser, React Aria masque le reste de la page : axe n'y est pas lancé (il signale l'absence de h1).
