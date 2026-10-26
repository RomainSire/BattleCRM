# Liste de contrôle d'accessibilité

WCAG 2.2 AA en entier (spec UX §1 et §7, ST-80). Ce que les tests vérifient seuls n'est pas répété ici :

- **axe**, bloquant, sur chaque écran et dans les deux thèmes : en composant (`apps/web`) et contre les images construites (`e2e/tests/accessibility.spec.ts`, bureau et largeur de téléphone, écrans hors session compris) ;
- **clavier** : kanban, panneau et notification « Annuler » en composant, et le déplacement d'une carte du Funnel au clavier seul en bout en bout (`e2e/tests/kanban.spec.ts`).

Le reste se vérifie à la main, avec cette liste, **quand un écran est créé ou remanié**. Le ticket qui le fait coche la liste pour cet écran. Un écart qu'on ne corrige pas s'écrit dans la spec UX §1, avec son motif.

## La liste

Pour chaque écran, dans les deux thèmes.

### Lecteur d'écran (Orca sous Linux, NVDA sous Windows)

- [ ] Les régions repères s'annoncent : « Menu principal », le contenu, et le panneau quand il est ouvert. « Aller au contenu » est le premier arrêt de Tab et mène au contenu.
- [ ] Le titre de niveau 1 nomme l'écran ; les titres suivent sans sauter de niveau.
- [ ] Chaque contrôle a un nom qui dit ce qu'il fait, sans le contexte visuel (« Actions de Marc Roy », pas « ⋯ »).
- [ ] Ce que montrent la couleur, une jauge ou un graphe se lit aussi en texte : phrase de la jauge, tableau de l'Activité et du Funnel, « prouvé » / « désigné », étoile « Allié », palier et Jours sans contact d'un Allié.
- [ ] Une notification « Annuler » et la célébration s'annoncent une fois, sans couper la lecture en cours (région polie). Les confettis ne s'annoncent pas.
- [ ] Un panneau ou une fenêtre qui s'ouvre annonce son titre ; à la fermeture, le focus revient à ce qui l'a ouvert.
- [ ] Une erreur s'annonce, et le champ fautif dit qu'il est invalide.

### Zoom à 400 %

Navigateur à 1280 × 1024, zoom à 400 % : la page fait alors 320 px de large.

- [ ] La page ne défile pas en largeur. Seuls le kanban et les tableaux larges défilent, dans leur propre cadre.
- [ ] Tout reste atteignable et utilisable : menu, panneaux, fenêtres et leurs boutons de validation, notifications.
- [ ] Aucun texte n'est coupé ni ne passe sous un autre.

### Focus

- [ ] Au clavier, le focus se voit partout : anneau teal de 2 px, avec décalage.
- [ ] Il n'est jamais masqué : ni par la barre d'onglets ou le bouton « Ajouter » du mobile, ni par une notification, ni sous un en-tête collé.
- [ ] L'ordre de Tab suit l'ordre de lecture.
- [ ] Tout ce qui se fait à la souris se fait au clavier : glisser-déposer compris (bouton « Déplacer »), avec `Échap` pour fermer.

### Cibles

- [ ] Sur bureau, chaque cible fait au moins 24 × 24 px, ou garde 24 px d'espace libre autour d'elle. Exceptions admises par WCAG 2.5.8 : un lien dans une phrase, ou une cible doublée par un contrôle équivalent qui, lui, a la taille.
- [ ] Sur mobile, les actions rapides font au moins 44 px de haut.

## Passage du 2026-10-26 (ticket 45)

Sur tous les écrans : Aujourd'hui, Cercle, Contacts, fiche Contact, Organisation, Funnel, Battles, Positionnements, Indicateurs, Réglages, Plus, et les écrans d'authentification.

- **Zoom à 400 %** : à 320 px de large, aucun écran ne défile en largeur (le kanban défile dans son cadre), et chaque arrêt de Tab reste visible (point suivant) : tout est atteignable. Passage dans le thème clair : le thème sombre ne change que les couleurs, qu'axe juge dans les deux. Le texte coupé reste à regarder à l'œil.
- **Focus** : 60 appuis sur Tab par écran, au bureau, sur téléphone et à 400 % : l'élément qui a le focus n'est jamais sous un autre élément.
- **Cibles** : pas d'écart. Les cibles de moins de 24 px sont des liens de texte isolés (fil d'Ariane, noms dans les listes, « Indicateurs → », Étapes de Battles), qui ont l'espace requis. Les cases de 12 px du graphe d'Activité (Indicateurs) ne sont pas dans l'ordre de Tab : « Voir en tableau » donne les mêmes données, avec un contrôle à la bonne taille (exception « contrôle équivalent » de WCAG 2.5.8).
- **Lecteur d'écran** : sans écart dans ce qu'un outil peut lire. axe vérifie les noms, l'ordre des titres et les régions repères ; l'arbre d'accessibilité montre la notification « Annuler » dans une région polie, et la fiche ouverte en panneau dans une région à son nom. **Reste à faire : l'écoute dans Orca ou NVDA**, que seule une personne peut juger.

Aucun écart à consigner dans la spec UX §1.
