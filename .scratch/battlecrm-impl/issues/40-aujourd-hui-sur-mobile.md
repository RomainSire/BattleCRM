# 40: Aujourd'hui sur mobile

**What to build:** en largeur étroite, Aujourd'hui présente une carte à la fois dans l'ordre de priorité, avec la progression de la journée : d'abord la carte Entrées (un Contact du Vivier, « Faire entrer… » et « Un autre »), puis les Relances et les Alliés, les Essais délai dépassé, les Battles concluantes, jusqu'à l'écran « journée bouclée » où la célébration se fond. Sources : spec UX §5.1 (mobile), §3.2 ; prototypes `prototype/01-aujourdhui` (C) et `prototype/03-page-cercle` (C) ; ST-47.

**Blocked by:** 38, 39

**Status:** resolved

- [x] Une carte par élément, ordre de la spec UX §5.1 ; pas de « Plus tard » sur la carte d'un Allié
- [x] « Un autre » tire un Contact de plus du Vivier (même tirage du jour sur tous les appareils)
- [x] Barre de progression et écran « journée bouclée »
- [x] Bouton + flottant (Ajouter un Contact, Noter une Interaction…) ; cibles de 44 px ; focus jamais masqué par les éléments collés

## Comments

**2026-10-25, implémentation (agent).**
- **API, module `views`** : colonne `daily_pick.passed` (migration 0045, ajout seul, appliquée à la base de dev). `POST /today/picks/entries/:id/pass` (« Un autre ») marque le tirage d'entrée du jour passé et renvoie les tirages du jour : un Contact du Vivier pas encore tiré prend sa place ; le Vivier épuisé, les passés reviennent derrière les autres, le premier passé d'abord (on boucle). Repasser un Contact déjà passé (appareil en retard) répond pareil ; 404 pour un Contact non tiré ce jour-là, sorti du Vivier ou d'un autre Utilisateur. Spec stack amendée (ligne `views`).
- **Écran** (`today/today-deck.tsx`, branché dans `today-screen.tsx` en largeur étroite) : une carte à la fois, nommée par ce qu'elle est (« Entrées cette semaine 2/5 », « Relance », « Allié à relancer », « Essai délai dépassé », « Battle concluante »), dans l'ordre de la spec UX §5.1 ; « Carte précédente » / « Carte suivante » (44 px) et « Carte 2 sur 7 » annoncé poliment. Carte Entrées : un Contact du Vivier, **Faire entrer…** et **Un autre** (masqué quand le Vivier n'en a qu'un). Carte d'un Allié : **Prendre des nouvelles…** seul, sans « Plus tard ». Barre de progression (`<progress>`, « 3 traités sur 8 ») ; une carte traitée cède la place à la suivante, qui prend le focus. Plus de carte : « Journée bouclée. » et « n éléments traités aujourd'hui. », puis Sans prochaine action, l'Activité du jour (la célébration s'y pose : toast, confettis, « Objectif atteint »), le Cercle et À venir. `Row` est sorti dans `today-row.tsx` ; `ConclusiveBattle` (une Battle) sorti de `ConclusiveBattles`.
- **Bouton + flottant** (`shell/floating-add.tsx`, dans la coque, sur toutes les largeurs étroites) : contour d'accent (pas de second bouton plein), 56 px, au-dessus des onglets ; « Ajouter un Contact » ou « Noter une Interaction… », qui fait choisir le Contact puis ouvre le geste sur sa fiche en page (« Prendre des nouvelles… » pour un Allié, §6.4). La fenêtre de choix du Cercle est devenue `contacts/pick-contact.tsx`, partagée. **Focus jamais masqué** : `scroll-padding-bottom` 9rem, `main` rallongé de quoi passer sous le bouton, notifications remontées au-dessus du bouton.
- **Tests** : `views/daily-picks.test.ts` (« Un autre », boucle, repasser, refus), `security.test.ts` (nouvelle route) ; `today-screen.test.tsx` (ordre des cartes, pas de « Plus tard » sur un Allié, « Un autre », carte Entrées absente, progression et journée bouclée, célébration sur mobile, Vivier vide, bouton +, cibles de 44 px et focus jamais sous l'en-tête, le bouton + ou les onglets, axe dans les deux thèmes).
- **À trancher** :
  - **Quand la carte Entrées est-elle traitée ?** Choix fait : elle quitte le paquet dès qu'un Contact est entré dans le Funnel ce jour-là (sinon « journée bouclée » n'arrive jamais tant que le Vivier n'est pas vide). La spec dit pourtant « les propositions restent une fois l'objectif atteint » (vrai sur bureau, où le bandeau reste). Le compteur des Entrées reste affiché au-dessus du paquet, avec « Ajouter un Contact » quand le Vivier est vide. Autres options : à l'Objectif d'entrées de la semaine atteint, ou jamais (la carte reste, hors progression).
  - **Progression par onglet** : « traités » compte les cartes vues sur cet onglet puis disparues (sessionStorage par jour). Un autre appareil ou un nouvel onglet repart de 0 ; une journée bouclée ailleurs affiche « Rien à traiter aujourd'hui. ».
  - **Glossaire** : ni le tirage du jour, ni « passé » (« Un autre ») n'ont de terme dans CONTEXT.md (déjà soulevé au ticket 38).
  - **Choix du Contact au clavier dans les tests** : à 390 px, Playwright ne parvient pas à cliquer une option de la liste dans la fenêtre modale (il fait défiler la page, la liste se repositionne). Le test choisit au clavier ; à vérifier au doigt sur un vrai téléphone.
