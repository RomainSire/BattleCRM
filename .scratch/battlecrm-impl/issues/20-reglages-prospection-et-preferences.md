# 20: Réglages : Prospection et Préférences

**What to build:** l'écran Réglages, avec ses ancres, où l'Utilisateur règle son Objectif d'activité (dès le lendemain), son Objectif d'entrées (dès le lundi suivant), la Cadence par défaut, le Rythme des Alliés, la Taille visée du Cercle, la célébration, sa langue, son fuseau (dès le lendemain), le thème de l'appareil et les raccourcis à une touche. Enregistrement automatique avec « Annuler », sauf la Cadence par défaut. Sources : spec UX §5.8 (sauf la section Funnel, ticket 35), §3.3 ; spec stack §5.2 ; ADR 0003 ; ST-40, ST-42, ST-49 à ST-58.

**Blocked by:** 06

**Status:** resolved

- [x] Module `settings` : valeurs en vigueur `(user_id, effective_from, value)` pour le fuseau, l'Objectif d'activité, l'Objectif d'entrées (« aucun objectif » compris) ; `activityGoalOn(tx, date)`, `entryGoalForWeek(tx, monday)`, écritures « à partir du lendemain / du lundi suivant », testées aux changements d'heure et à minuit
- [x] Préférences par Utilisateur portées par le résumé : langue, célébration (grisée quand l'Objectif est désactivé), raccourcis à une touche, Rythme des Alliés (28 j), Taille visée (10, désactivable), Cadence par défaut (intervalles et Délai de réponse, sans message, bouton « Enregistrer »)
- [x] Microcopie « S'applique à partir de demain » / « S'applique à partir du lundi 12 oct. »
- [x] Préférences par appareil : thème ; « Réduire les animations » suit le système sans réglage
- [x] « Raccourcis à une touche » coupe `N`, `/`, `?`, `G` + lettre et `V` ; `Ctrl K` et `Échap` restent actifs
- [x] Changer de langue change l'interface et `lang` ; mobile (Plus) : langue, thème, célébration, Compte
- [x] Chaque enregistrement automatique est annulable (test nominal + Annuler)

## Comments

**2026-10-14, implémentation (agent).**

- **API** : `POST /api/settings` dans `settings` (`routes.ts`), corps partiel : seuls les champs envoyés changent (`locale`, `timeZone`, `activityGoal`, `entryGoal`, `celebrateGoal`, `singleKeyShortcuts`, `checkInRhythmDays`, `circleSizeGoal`, `defaultCadence: { intervals, responseWindowDays }`), 400 `invalid` hors bornes ; répond `{ settings }`. Écritures datées dans `write.ts` : Objectif d'activité et fuseau à partir du lendemain, Objectif d'entrées à partir du lundi suivant (`nextMondayAfter`, ajouté à `packages/domain`), lus dans le fuseau en vigueur ; un changement remplace tout autre à venir, et une valeur égale à celle d'avant n'écrit aucune ligne. Lectures `activityGoalOn(tx, userId, day)`, `entryGoalForWeek(tx, userId, monday)` (avec le `userId`, comme `localDateOf`) et `settingsOf`, porté par le résumé (`settings`, chaque valeur datée en `{ inEffect, chosen }`). Tests à minuit, au passage à l'heure d'été et à l'heure d'hiver.
- **Données** : migrations `0019_settings` (colonnes de `user_settings` avec défaut, tables `effective_activity_goal` et `effective_entry_goal`, `null` = désactivé, CHECK du lundi) et `0020_settings_access` (RLS forcée), compatibles avec la version précédente, appliquées à la base de dev. Avant sa première ligne, un Objectif vaut sa valeur par défaut : aucune reprise des Utilisateurs existants (une reprise sous RLS forcée n'aurait pas pu lire leurs fuseaux).
- **« Annuler »** (spec stack §5.4 amendée) : pas de ligne `gesture`, un réglage ne touche aucun Contact. La SPA renvoie les valeurs d'avant par le même endpoint ; la valeur d'avant ne laissant aucune ligne, rien ne reste. Limite assumée : un « Annuler » envoyé après minuit (ou après le passage au lundi) ne défait pas le jour qui vient de commencer, où la valeur est déjà en vigueur (ADR 0003) ; il la rétablit à partir du lendemain. Le thème s'annule sur l'appareil. La notification porte `undo` (fonction) à côté de `undoToken`.
- **SPA** : `settings/use-settings.ts` (`useSettings`, `settingsOf` avec valeurs par défaut pour un résumé gardé sur l'appareil d'avant ce ticket, `useChangeSettings`, `useSingleKeyShortcuts`), `setting-fields.tsx` (nombre enregistré à la validation, Objectif désactivable, case), `prospecting-settings.tsx`, `preferences-settings.tsx`, écran à ancres (Prospection, Préférences, Compte ; Funnel au ticket 35). Sur mobile : langue, thème, célébration, Compte. La langue de l'Utilisateur s'applique à l'appareil dès la lecture du résumé (`lang` compris). « Changer d'État… » lit désormais l'Objectif d'entrées de la semaine, la Taille visée et le Rythme (comptes seuls quand un Objectif est désactivé). La célébration est grisée dès que l'Objectif choisi est désactivé.
- **Raccourcis** : seul `N` existe aujourd'hui ; `/`, `?`, `G` + lettre et `V` arriveront avec les tickets 41 et 33 et **doivent** passer par `useSingleKeyShortcuts`. La barre latérale masque les repères `N` et `?` quand ils sont coupés.
- **Bornes choisies** (aucune dans la spec) : Objectifs et Taille visée 1 à 999, jours 1 à 365, au plus 10 intervalles.
