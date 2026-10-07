# Architecture : où vivent les règles du domaine

Type: grilling
Status: resolved
Blocked by: 06, 07

## Question

Comment le code est-il découpé, et où vivent les règles du domaine ? Consulter `codebase-design`.

À trancher :
- Modules et frontières : Funnel, Contacts et Organisations, Positionnements, Battles, Essais et Tirage, Relances et Cadence, Activité.
- Où se calculent la Règle de victoire (ADR 0001, ST-45), le Tirage équilibré par Cible (ST-34, ADR 0002), les valeurs en vigueur (ADR 0003 : ordre du Funnel, fuseau, Objectif d'activité), les états « à traiter / en attente / sans prochaine action » (ST-46, ST-47).
- Isolation par Utilisateur (ST-23) : tranchée par « [Base de données et accès aux données](07-donnees.md) » (`withUser`, RLS forcée, ADR 0009) ; reste où vit le module de données et comment les modules l'appellent.
- Le domaine est-il partagé avec le front (calculs côté client pour la fluidité, la consultation hors ligne) ?

- Auth (« [Auth : bibliothèque, sessions et client extension](08-auth.md) », ADR 0010) : un module `auth` seul à toucher les tables d'auth, qui n'expose que « qui est l'Utilisateur de cette requête » ; reste son emplacement et sa frontière avec le module de données. Un planificateur tourne dans le processus de l'API (tâches d'auth) : d'autres modules y auront-ils des tâches ?

## Comments

- 2026-10-07, premier tour avec Romain (accepté tel quel) : paquet `packages/domain` pur (sans E/S, « maintenant » et fuseau en paramètres) partagé API et SPA ; API en modules profonds `prospecting`, `battles`, `funnel`, `organizations`, `settings`, `views`, `auth`, chacun seul à écrire ses tables, appels croisés par fonctions exportées qui reçoivent la `tx`, pas de couche repository ; un endpoint par geste (une transaction), lectures par vue, client RPC de Hono + Zod écrit à la main ; résumé de travail complet dans la SPA (`GET /summary`, mis à jour par les lignes que renvoie chaque geste, persisté pour le hors-ligne) ; module `db` qui exporte `withUser` à tous et la connexion brute à `auth` seul (lint), middleware d'`auth` qui pose l'Utilisateur ; module d'infrastructure `jobs` où les modules inscrivent des tâches idempotentes, le domaine n'en ajoute aucune ; tirages stables du jour (ST-47) en table remplie paresseusement à la première lecture du jour, dans `views`. **Tout le code en anglais** (consigné dans les Notes de la carte).
- 2026-10-07, second tour avec Romain (accepté tel quel) : noms du code d'après les `_EN_` du glossaire, ST-47 en `daily picks` ; états du jour calculés par `packages/domain` des deux côtés ; Règle de victoire exacte et déterministe ; « Annuler » côté serveur par geste inverse, le Tirage survit, 15 min ; valeurs en vigueur exposées par `settings` ; paquets `domain` et `contract` séparés. ADR 0011 et 0012.

## Answer

Tranché avec Romain le 2026-10-07 ; ADR [0011 « Annuler » défait le geste côté serveur](../../../docs/adr/0011-annuler-defait-le-geste-cote-serveur.md) et [0012 Règles pures partagées, résumé de travail complet dans la SPA](../../../docs/adr/0012-regles-pures-partagees-resume-complet-dans-la-spa.md). **Tout le code est en anglais.**

- **Noms** : identifiants d'après la ligne `_EN_` de `CONTEXT.md` (`Contact`, `Status` = `pool | prospecting | ally | archived`, `Stage`, `Aim`, `Positioning`, `Battle`, `Trial`, `Assignment`, `Override`, `FollowUp`, `FollowUpCadence`, `ResponseWindow`, `WinRule`, `Horizon`, `Verdict`, `Interaction`, `CheckIn`, `CheckInRhythm`, `FunnelEntry`, `Activity`, `ActivityGoal`, `EntryGoal`) ; base en `snake_case` anglais (`anonymized_at`, `(user_id, effective_from, value)`). Les « tirages stables » de ST-47 ne sont pas des Tirages : `daily picks` (table `daily_pick`). Une notion du domaine sans terme au glossaire se règle d'abord dans le glossaire (règle de revue).
- **Paquets partagés** : `packages/domain`, règles pures sans E/S (ni base, ni `fetch`, ni horloge ; « maintenant », fuseau et hasard en paramètres), avec ses propres types d'entrée, importé par l'API et la SPA ; `packages/contract`, schémas Zod écrits à la main et types de l'API. `domain` n'importe ni `contract`, ni les jetons de thème, ni les messages.
- **Modules de l'API** (`apps/api/src/…`), profonds, chacun seul à écrire ses tables ; un autre module passe par une fonction exportée qui reçoit la même `tx` ; pas de couche repository, les gestes écrivent leur SQL Drizzle dans `withUser` :
  - `prospecting` : Contacts, États, Interactions, Relances et Cadence, Essais et Tirage (les gestes de la fiche Contact) ;
  - `battles` : ouvrir, clôturer, Verdict, Champion, Historique des Champions ;
  - `funnel` : Étapes (ordre, archivage), Positionnements (copie modifiée, pièces jointes) ; exporte `stageOrder(tx)` ;
  - `organizations` : unicité normalisée, fusion (ST-31) ;
  - `settings` : préférences et valeurs en vigueur ; exporte `localDateOf(tx, instant)`, `activityGoalOn(tx, date)`, `entryGoalForWeek(tx, monday)` et les écritures « à partir du lendemain / du lundi suivant ». « Le lendemain » s'entend dans le fuseau en vigueur au moment du changement ;
  - `views` : lectures par vue (`GET /summary`, « Aujourd'hui », Indicateurs, Activité, Taux de passage) et `daily_pick`, remplie paresseusement à la première lecture du jour local, complétée par « Un autre » et le remplacement, jours passés purgés au fil de l'eau ;
  - `auth` (ADR 0010) : son propre schéma Drizzle, middleware qui pose `c.var.userId` ou répond 401 ; rien d'autre n'est exposé ;
  - `db` : exporte `withUser(userId, fn)` à tous et la connexion brute (`withoutIsolation`) à `auth` seul, règle de lint à l'appui ; le point d'entrée `migrate` a ses propres identifiants propriétaires ;
  - `jobs` : planificateur dans le processus, où les modules inscrivent des tâches idempotentes ; seul `auth` en a, la file d'e-mails pourra s'y brancher ; le domaine n'en ajoute aucune (« rien n'est automatique »).
- **Écritures** : un endpoint par geste (`POST /contacts/:id/use-positioning`…), une transaction chacun ; chaque geste renvoie les lignes du résumé qu'il a changées et un `undoToken`. **Transport** : client RPC de Hono (`hc<AppType>`), repli `fetch` + Zod.
- **SPA** : tient le résumé de travail complet (`GET /summary`) dans TanStack Query, persisté dans IndexedDB pour le hors-ligne ; recherche, doublons, pastille ST-46 et « Aujourd'hui » calculés localement ; le détail (historiques, agrégats sur 12 mois) se charge à la demande.
- **Où vivent les règles** :
  - états du jour (`contactAgenda(contact, today)`, `allySignal(ally, today, rhythm)`) : `packages/domain`, jamais stockés, appelés par la SPA et par `views` (candidats « sans prochaine action ») ; `today` calculé dans le fuseau en vigueur porté par le résumé ;
  - Règle de victoire (`evaluateWinRule(counts, threshold, horizon)`) : `packages/domain`, calcul exact et déterministe sur deux lois Bêta, pas de Monte-Carlo ;
  - Tirage : choix équilibré pur (`chooseAssignment(counts, random)`) dans `packages/domain` ; hasard (`crypto.randomInt`), verrou sur la Battle et réservation dans `prospecting` ;
  - sens d'un changement d'Étape : positions de départ et d'arrivée dans l'ordre du moment, stockées sur le changement (ST-33) ;
  - jour local : calculé à l'écriture par `settings.localDateOf`.
- **« Annuler » (ST-62, ADR 0011)** : `POST /gestures/:id/undo` défait le geste dans une transaction (supprime ce qu'il a créé, restaure ce qu'il a modifié) d'après la table `gesture` ; chaque module écrit l'inverse de ses gestes ; le Tirage révélé survit ; accepté 15 min, refusé si un geste ultérieur a touché le même Contact ou la même Battle ; une célébration affichée n'est pas défaite.
- **Pièces jointes (ST-35)** : stockage renvoyé à « Déploiement » (volume monté dans l'API, route qui vérifie le propriétaire).
