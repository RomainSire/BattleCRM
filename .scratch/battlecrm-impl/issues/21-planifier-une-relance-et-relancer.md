# 21: Planifier une Relance et Relancer…

**What to build:** sur un Contact En prospection ou un Allié, l'Utilisateur planifie une Relance (ou la modifie, la reporte, l'annule), la voit en tête du fil, puis la fait par « Relancer… » : une Interaction sortante datée, qui compte +1 dans l'Activité. Ici, la Relance est hors Cadence ; les rangs et messages arrivent au ticket 26. Sources : spec UX §5.3 (tête du fil), §6.3, §6.5 ; CONTEXT (Relance, Action de prospection, Activité) ; ST-36, ST-41.

**Blocked by:** 16

**Status:** resolved

- [x] Au plus une Relance planifiée par Contact (index unique partiel) ; seuls En prospection et Allié en ont ; planifier quand elle existe = « Modifier la Relance »
- [x] Planifier / Modifier : date (demain, +3 j, +7 j, +14 j, ou une date), note facultative, récapitulatif ; `P` sur la fiche
- [x] Tête du fil : la Relance planifiée comme élément futur (« hors Cadence », signal en retard / aujourd'hui, note ; Relancer… / Modifier / Annuler) ou le rappel « sans prochaine action » avec « Planifier une Relance » (point d'attention : élément fragile dans le prototype)
- [x] Relancer… (`F`) : note de la Relance et dernière Interaction sortante, date et note modifiables, récapitulatif « +1 à l'Activité » ; la Relance devient une Interaction faite, datée du jour saisi (dates passées permises, jour local depuis la date saisie)
- [x] Reporter (demain, +3 j, +7 j) et Annuler la Relance
- [x] Le résumé porte la Relance planifiée de chaque Contact et ce qu'il faut pour calculer l'Activité du jour ; gestes testés (nominal + Annuler)

## Comments

**2026-10-14, implémentation (agent).**

- **API** (`prospecting`) : table `follow_up` (`status` `scheduled | done | canceled`, `due_on` jour local, `note`, `interaction_id` une fois faite, `scheduled_at`), index unique partiel `follow_up_scheduled_unique` (au plus une planifiée par Contact), `CHECK` qu'une Relance faite, et elle seule, pointe vers son Interaction ; `interaction.note` (facultative). Migrations `0021_follow_ups` (FORCE RLS levé le temps des clés étrangères, comme `0013`) et `0022_follow_ups_access` (RLS forcée), appliquées à la base de dev. Trois gestes, chacun avec son inverse :
  - `POST /contacts/:id/schedule-follow-up` `{ dueOn, note? }` : planifie, ou modifie celle qui existe (une note omise est vidée) ; 409 `no_follow_up_in_status` hors En prospection et Allié, 400 `past_day` avant aujourd'hui (fuseau de l'Utilisateur). « Annuler » supprime une Relance créée, rend jour et note à une Relance modifiée. Reporter passe par ce même endpoint.
  - `POST /contacts/:id/cancel-follow-up` : la Relance passe en annulée ; 409 `no_follow_up`. « Annuler » la replanifie.
  - `POST /contacts/:id/follow-up` `{ occurredOn, note? }` (Relancer…) : Interaction `follow_up` sortante, `local_date` = le jour saisi (ST-36), instant d'autant de jours avant maintenant (il ne sert qu'à ordonner le fil) ; 400 `future_day`, 409 `no_follow_up`. « Annuler » supprime l'Interaction et replanifie la Relance.
  - Changer d'État annule la Relance planifiée sauf vers En prospection (quitter En prospection, aller au Vivier ou en Archivé ; un Allié qui entre garde la sienne) ; « Annuler » la rend (`canceledFollowUpId`, absent des gestes d'avant).
- **Résumé** : chaque Contact porte `followUp` (`{ dueOn, note }` ou `null`) et `prospectingActionDays` (jours locaux de ses Actions de prospection, `PROSPECTING_ACTION_KINDS` = `follow_up` pour l'instant). Le fil porte la note de chaque Interaction.
- **`packages/domain`** : `followUpSignal(dueOn, today)` (`overdue | today | upcoming`) et `activityOn(contacts, day)`, testés. **`packages/contract`** : `FOLLOW_UP_NOTE_MAX_LENGTH`.
- **SPA** (`contacts/follow-up.tsx`) : panneau ouvert dans l'adresse (`?followUp=schedule|do`, ST-70), brouillon en `sessionStorage`. Planifier / Modifier (`P`) : demain, +3 j (par défaut), +7 j, +14 j ou une date (aujourd'hui ou plus tard), note, récapitulatif « Relance le … · hors Cadence ». Relancer… (`F`) : « Envoie-le » (note de la Relance, dernière Interaction sortante), « Confirme » (aujourd'hui, hier ou une date passée, note préremplie avec celle de la Relance), récapitulatif « +1 à l'Activité d'aujourd'hui (n/objectif) » ou « du <date> ». Tête du fil : la Relance (hors Cadence, date, « En retard » / « Aujourd'hui » en ambre, note ; Relancer… / Modifier / Reporter (demain, +3 j, +7 j, comptés depuis aujourd'hui) / Annuler, avec « Annuler » dans la notification), sinon « Sans prochaine action » (En prospection) et « Planifier une Relance ». Bloc Prochaine action : Relance due ou en retard → bouton plein Relancer… ; sous `⋯`, Planifier / Modifier la Relance et Relancer… quand elle est à venir. Récapitulatif de Changer d'État : « La Relance du … est annulée ». `contactRecordQuery` déplacé dans `contact-record-query.ts` ; `MoreActions` accepte un déclencheur texte (Reporter).
- **Revue** : Reporter et Annuler disaient rien quand le serveur refusait (Relance changée sur un autre appareil) : ils l'affichent désormais ; le bloc Prochaine action d'un Allié porte le signal de sa Relance.
- **Laissé aux tickets suivants** : rangs et messages de Cadence, « Relance suivante » au récapitulatif, écart tracé quand la date change pendant un Essai (26, 28) ; sur un Allié, `F` sur « Prendre des nouvelles… » quand aucune Relance n'est due (36) ; palette (41), Aujourd'hui (37).
