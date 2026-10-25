# 41: Palette de commandes et raccourcis

**What to build:** `Ctrl K` ou `/` ouvre la palette : sans saisie, les Contacts à traiter et les Alliés à relancer ; pendant la frappe, des groupes (Contacts, Organisations, Actions, Créer, Aller à, Préférences) ; un Contact se choisit puis ses actions s'affichent, ou l'Utilisateur tape un verbe (« relancer jul »). Les raccourcis `G` + lettre et l'aide `?` complètent la navigation au clavier ; sur mobile, la loupe de l'en-tête ouvre la même palette. Sources : spec UX §3.3, §3.2 ; ST-63, ST-65.

**Blocked by:** 30, 36

**Status:** resolved

- [x] Palette (Autocomplete React Aria) en fenêtre centrée, recherche en mémoire sur le résumé ; « Rechercher… » de la navigation l'ouvre
- [x] Sans saisie : à traiter et Alliés à relancer mêlés par ancienneté du retard
- [x] Contact d'abord : `→` ou `Tab` affiche ses actions filtrées par son État (liste de la spec UX §3.3, jamais le verbe de l'État actuel) ; `⌫` dans le champ vide revient ; `Entrée` ouvre la fiche en page ; sans résultat, propose d'ajouter ce nom
- [x] Verbe d'abord : un mot du verbe suffit (« nouvelles », « cercle », « entrer », « archiver », « vivier »…)
- [x] `G` puis `A` `E` `C` `F` `B` `P` `I` `R` avec repère « G … » affiché ; `?` ouvre l'aide des raccourcis ; jamais dans un champ de saisie ; respect de « Raccourcis à une touche »
- [x] Tests de composant au clavier ; axe sans erreur dans les deux thèmes

## Comments

**2026-10-25, implémentation (agent).**
- **Palette** (`palette/command-palette.tsx`, logique pure dans `palette/palette-items.ts`) : `Autocomplete` React Aria dans une fenêtre centrée, recherche en mémoire sur le résumé. Sans saisie : les Contacts à traiter (Relances dues ou en retard, Essais délai dépassé) et les Alliés à relancer, mêlés par jours de retard (un Essai compte depuis la fin de son délai). Pendant la frappe : Contacts (nom, Organisation, Étape, et aussi poste et e-mail via `contactsMatching`), Organisations, Actions (verbe d'abord), Créer, Aller à, Préférences et autres. Huit résultats au plus par groupe de Contacts ou d'Organisations.
- **Contact d'abord** : `→` (curseur en fin de saisie) ou `Tab` affiche ses actions, filtrées par État dans l'ordre de la spec, jamais le verbe de l'État actuel ; `⌫` dans le champ vide revient à la saisie d'avant. Chaque action ouvre le geste sur la fiche en page, par l'adresse (`/contacts/$id?followUp=do`…). `Tab` est capté sur la fenêtre avant le piège de focus du dialogue. **Au toucher (largeur étroite)**, choisir un Contact affiche ses actions, « Ouvrir la fiche » en tête : sans `→`, c'est le seul chemin vers ses actions.
- **Verbe d'abord** : le premier mot, trois lettres au moins, au début d'un mot du verbe (« nouvelles », « cercle », « entrer », « archiver », « vivier »…), le reste cherche les Contacts. Il faut un nom après le verbe.
- **Raccourcis** : `Ctrl K` toujours actif, même depuis un champ (et retenu au navigateur palette ouverte) ; `/` et `?` (Maj tolérée, AZERTY) ; `G` puis `A E C F B P I R` (`shell/go-to.tsx`) avec repère « G … » affiché pendant l'attente (1,5 s). La lettre après `G` est captée avant les raccourcis de la page (le `F` d'une fiche ne s'ouvre pas). Rien dans un champ, rien par-dessus une autre fenêtre, et « Raccourcis à une touche » coupe `/`, `?` et `G`. Aide `?` : `shell/shortcuts-help.tsx`, aussi derrière « Raccourcis » de la barre latérale. « Rechercher… » de la barre latérale et la loupe mobile ouvrent la palette (`palette/palette-context.ts`).
- **Au passage** : la vue du Funnel est devenue partagée (`useSyncExternalStore`) pour que « Funnel : kanban ou table » bascule aussi un Funnel déjà affiché ; `useSignOut` sorti de `shell/account.tsx` ; noms de langue et libellés de thème exportés de `settings/preferences-settings.tsx` et réutilisés.
- **Tests** : `palette/command-palette.test.tsx` (ouverture et liste sans saisie, Contact d'abord, Allié, `Entrée`, verbe d'abord ×6, jamais le verbe de l'État actuel, groupes, ajout d'un nom inconnu, `/`, menu et loupe, `G` + lettre, `?`, raccourcis coupés et `Ctrl K` depuis un champ, rien dans un champ, mobile au toucher, axe dans les deux thèmes palette et aide ouvertes).
- **À trancher** :
  - **« Créer un Positionnement »** ouvre la création sur la première Étape non archivée, **« Ouvrir une Battle… »** sur la première Étape sans Battle ouverte (sinon la page Battles). La spec ne dit pas quelle Étape.
  - **« Relancer… »** n'est proposé qu'à un Contact qui a une Relance (comme le menu `⋯` de la fiche) : « relancer jul » ne trouve rien pour une Julie sans Relance.
  - **Glossaire** : « palette de commandes » est un élément d'interface, pas un terme du domaine : rien ajouté à CONTEXT.md.
