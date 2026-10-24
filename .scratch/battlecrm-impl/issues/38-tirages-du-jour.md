# 38: Tirages du jour

**What to build:** sur Aujourd'hui, le bandeau Entrées (« Entrées cette semaine 2/5 ») propose 3 ou 4 Contacts du Vivier tirés au hasard avec « Faire entrer… », chacun remplacé par un nouveau tirage une fois entré ; la liste des Contacts sans prochaine action en montre 3 ou 4 tirés une fois par jour ; une Battle concluante propose Clôturer… ou Plus tard. Ces tirages restent les mêmes toute la journée sur tous les appareils. Sources : spec UX §5.1 ; spec stack §5.2 (`daily_pick`) ; ST-47, ST-49.

**Blocked by:** 37, 19

**Status:** resolved

- [x] Table `daily_pick` du module `views`, par jour local : remplie à la première lecture du jour, complétée au remplacement d'un Contact entré et par « Un autre » (ticket 40)
- [x] Bandeau : compteur des Entrées de la semaine du lundi face à l'Objectif d'entrées en vigueur (couleur de succès une fois atteint, « 6/5 » si dépassé, « 3 cette semaine » si désactivé) ; propositions (nom, Organisation, dernière Étape atteinte ou « jamais entré ») même une fois l'objectif atteint ; Vivier vide → « Ajouter un Contact » `N`
- [x] Contacts sans prochaine action : 3 ou 4 tirés une fois par jour, non remplacés une fois traités ; actions « Utiliser un Positionnement » et « Planifier une Relance »
- [x] Battles concluantes : Clôturer… (ticket 32), Plus tard masquée jusqu'au lendemain sur tous les appareils (stocké par jour local)
- [x] Ordre de priorité de la spec UX §5.1 ; tests avec l'horloge pilotable au passage de minuit

## Comments

**2026-10-24, implémentation (agent).**
- **Tirage au hasard** (`packages/domain/src/pick.ts`, `pickAtRandom`) : `count` éléments sans doublon, le hasard en paramètre ; l'API passe `random.int`. **Sans prochaine action** : `hasNoNextStep` (`agenda.ts`), la même règle que `contactAgenda`, que l'API applique aux faits qu'elle sélectionne (ADR 0012).
- **API, module `views`** : tables `daily_pick` (jour local, `entry` ou `no_next_step`, rang, clé étrangère composite vers le Contact) et `battle_postponement` (« Plus tard » par jour local), sous RLS forcée (migrations 0041, 0042). `GET /today/picks` : au jour local du fuseau en vigueur, sous un verrou consultatif par Utilisateur ; efface les jours passés ; tire 3 Contacts du Vivier et, quand un Contact tiré a quitté le Vivier, en tire un autre parmi ceux pas encore tirés ce jour-là, tant qu'il en reste ; tire 3 Contacts Sans prochaine action une seule fois, jamais remplacés ; renvoie les tirages d'entrée encore au Vivier, tous ceux Sans prochaine action, et les Battles remises à plus tard ce jour. `POST /today/battles/:id/later` : 204, ou 404 pour une Battle close, inconnue ou d'un autre Utilisateur. Sans « Annuler » : un choix d'affichage, pas un geste.
- **Écran** (`today/entries-banner.tsx`, `today/conclusive-battles.tsx`, `today/daily-picks.ts`) :
  - Bandeau Entrées : « Entrées cette semaine 2/5 », en couleur de succès dès l'objectif atteint, « 3/2 » au-delà ; « Entrées 3 cette semaine » sans objectif. Chaque tirage montre son Organisation et « dernière Étape : X » ou « jamais entré », avec **Faire entrer…**. Vivier vide : « Ajouter un Contact » `N`.
  - Les tirages sont relus à chaque Contact qui entre au Vivier ou en sort : le remplaçant s'affiche.
  - Section « Sans prochaine action » après les Essais délai dépassé, avec les actions des cartes du Funnel. Un Contact traité en sort. Elle reste affichée quand il n'y a rien à traiter.
  - « Battles concluantes » dans la colonne latérale, entre le Cercle et « À venir » : jauge et phrase, **Clôturer…** (la fenêtre du ticket 32, gardée par l'adresse `?battle=`) et Plus tard.
  - `TodayContactLink` est désormais partagé par les lignes et le bandeau.
- **Tests** : `pick.test.ts`, `agenda.test.ts` (accord avec `contactAgenda`), `views/daily-picks.test.ts` (5 cas, dont le passage de minuit à Paris avec l'horloge pilotable), `security.test.ts` (nouvelle table et nouvelle route), `today-screen.test.tsx` (10 cas de plus, axe dans les deux thèmes). Migration appliquée à la base de dev.
- **À trancher** :
  - **Glossaire** : CONTEXT.md n'a pas de terme pour ces tirages du jour, ni pour « Plus tard ». Le code suit la spec stack (`daily_pick`) et évite « Tirage »/*Assignment*, réservé au Tirage des Battles. Faut-il un terme ?
  - **Pas de Contact Sans prochaine action à la première lecture** : si aucun Contact n'y est encore, le tirage se fait à la première lecture où il y en a un, donc parfois en cours de journée. Même chose si tous les Contacts tirés sont supprimés. Un marqueur « déjà tiré ce jour » l'éviterait.
  - **Contact tiré revenu au Vivier** : un Contact tiré qui entre, puis revient au Vivier le même jour, réapparaît à côté de son remplaçant (4 propositions).
  - **Tirages illisibles (hors ligne)** : les Battles remises à plus tard réapparaissent, et la liste Sans prochaine action disparaît.
  - **Passage de minuit** : un écran Aujourd'hui resté ouvert ne change de jour qu'au prochain rendu, comme depuis le ticket 37.
