# 39: Objectif d'activité et célébration

**What to build:** la colonne latérale d'Aujourd'hui montre l'Activité du jour face à l'Objectif (jauge, graphe des 4 dernières semaines, lien « Indicateurs → ») ; au franchissement de l'Objectif, une seule fois par jour sur tous les appareils, des confettis partent de l'endroit de l'Action et le toast « Bravo, objectif du jour atteint ! 3 / 3 » s'affiche. Sources : spec UX §2 (célébration), §5.1 ; CONTEXT (Activité, Objectif d'activité) ; ADR 0011 ; ST-41, ST-42, ST-44, ST-53, ST-56, ST-69.

**Blocked by:** 37, 20

**Status:** resolved

- [x] Activité = Actions de prospection comptées au jour local de l'Interaction ; Objectif en vigueur ce jour-là
- [x] Jauge (« atteint » une fois l'Objectif atteint, rien sans Objectif) et graphe des 4 dernières semaines (intensité seule)
- [x] Fait « célébration du jour » enregistré côté serveur par jour local, porté par le résumé ; jamais défait par « Annuler »
- [x] ~40 confettis (teal, vert, gris) ~1,5 s, halo sur la carte d'Activité, coupés par `prefers-reduced-motion` (le toast reste), annoncés dans la région live ; désactivables par le réglage
- [x] Aucun enregistrement d'un Objectif manqué ; pas de paliers

## Comments

**2026-10-24, implémentation (agent).**
- **Activité** : calculée dans la SPA depuis le résumé (`prospectingActionDays` de chaque Contact, jour local écrit avec l'Interaction), `activityOn` de `packages/domain` ; l'Objectif est celui en vigueur aujourd'hui (`settings.activityGoal.inEffect`). Nouvelle règle partagée `activityGoalReached(activity, goal)` (jamais atteint sans Objectif), lue par l'API et la SPA (ADR 0012).
- **API, module `views`** : table `celebration` (une ligne par Utilisateur, le dernier jour local célébré), sous RLS forcée (migrations 0043, 0044, appliquées à la base de dev). `POST /today/celebration` vérifie côté serveur l'Activité du jour face à l'Objectif en vigueur et le réglage « Célébrer l'Objectif atteint », puis avance le jour par un upsert conditionnel : `celebrate: true` au premier appareil du jour seulement, `celebratedOn` dans tous les cas. Le résumé porte `celebratedOn`. Aucune ligne `gesture` : « Annuler » ne le défait jamais (ADR 0011). Rien n'est écrit pour un Objectif manqué. Spec stack amendée (ligne `views`, ST-44).
- **Écran** (`today/activity-card.tsx`) : en tête de la colonne latérale, « Activité du jour » : anneau teal et « 2/3 », phrase pour le lecteur d'écran, « Objectif atteint » (vert, avec une coche) une fois atteint ; sans Objectif, « 2 Actions aujourd'hui », sans anneau. Les dernières semaines comme sur GitHub (une colonne par semaine, la semaine en cours à droite, le lundi en haut et le dimanche en bas, les jours à venir vides), autant que la largeur en tient avec des jours d'environ 16 px, au moins 4, la taille des jours ajustée pour remplir la carte (mesurée par `ResizeObserver` : 12 semaines sur bureau, 16 sur un téléphone de 390 px ; la boîte mesurée porte `contain: inline-size`, sans quoi la grille la gardait large quand la fenêtre rétrécit, avec un défilement horizontal) ; demandé par Romain le 2026-10-24, spec UX §5.1 amendée, un carré par jour dont l'intensité dépend du jour le plus chargé, sans marque d'Objectif ; chaque jour dit son compte (liste, texte pour le lecteur d'écran et infobulle). Lien « Indicateurs → » vers `/insights`.
- **Célébration** (`today/celebration.tsx`) : `sendGesture` compare l'Activité du jour avant et après les lignes du geste ; au franchissement, sauf réglage coupé ou jour déjà célébré selon le résumé, `<Celebration />` (monté par la coque) demande `POST /today/celebration`. Au premier appareil : 40 confettis (teal, vert, gris, jetons du thème) ~1,5 s depuis le contrôle du geste, `aria-hidden`, coupés par `prefers-reduced-motion` ; halo sur la carte d'Activité ; toast « Bravo, objectif du jour atteint ! 3 / 3 » dans la région live polie.
- **Tests** : `views/celebration.test.ts` (une fois par jour et sur tous les appareils, passage de minuit à Paris, « Annuler » puis refaire, sous l'Objectif, Objectif désactivé, réglage coupé, Action datée de la veille) ; `security.test.ts` (nouvelle table) ; `today-screen.test.tsx` (jauge, « atteint », sans Objectif, graphe qui remplit la largeur et la suit quand elle rétrécit, sans défilement horizontal de 320 à 430 px, lien, franchissement avec confettis puis Annuler et refaire sans seconde célébration, animations réduites, déjà célébré ailleurs, réglage coupé, axe dans les deux thèmes). Nouvelle commande de test `emulateReducedMotion`. `app-shell.test.tsx` cherche désormais le lien Indicateurs dans le menu (Aujourd'hui en a un aussi).
- **À trancher** :
  - **Glossaire** : la célébration a maintenant une table, une route et un type du contrat, mais CONTEXT.md n'en parle que par « est célébré » (Objectif d'activité). Faut-il un terme ?
  - **Demande perdue** : si `POST /today/celebration` échoue (hors ligne, panne), rien n'est réessayé, et le geste suivant n'est plus un franchissement : pas de célébration ce jour-là.
  - **Minuit** : un geste à 23:59:59 dont la demande arrive après minuit est vérifié sur le nouveau jour, donc refusé. Même chose pour un Objectif changé à minuit tant que le résumé n'est pas relu (comme depuis le ticket 37 pour un écran resté ouvert).
  - **Compte du toast** : il vient du résumé de l'appareil, qui peut être en retard sur le serveur quand un autre appareil a noté des Actions.
  - **Sans Objectif** : la carte montre le compte du jour, sans jauge (« rien sans Objectif » lu comme « pas de jauge »).
  - **Le compte de l'Activité est écrit deux fois** : `activityOn` côté SPA, un `count(*)` SQL côté API, sur les mêmes `PROSPECTING_ACTION_KINDS`.
