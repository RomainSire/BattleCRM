# 21: Planifier une Relance et Relancer…

**What to build:** sur un Contact En prospection ou un Allié, l'Utilisateur planifie une Relance (ou la modifie, la reporte, l'annule), la voit en tête du fil, puis la fait par « Relancer… » : une Interaction sortante datée, qui compte +1 dans l'Activité. Ici, la Relance est hors Cadence ; les rangs et messages arrivent au ticket 26. Sources : spec UX §5.3 (tête du fil), §6.3, §6.5 ; CONTEXT (Relance, Action de prospection, Activité) ; ST-36, ST-41.

**Blocked by:** 16

**Status:** ready-for-agent

- [ ] Au plus une Relance planifiée par Contact (index unique partiel) ; seuls En prospection et Allié en ont ; planifier quand elle existe = « Modifier la Relance »
- [ ] Planifier / Modifier : date (demain, +3 j, +7 j, +14 j, ou une date), note facultative, récapitulatif ; `P` sur la fiche
- [ ] Tête du fil : la Relance planifiée comme élément futur (« hors Cadence », signal en retard / aujourd'hui, note ; Relancer… / Modifier / Annuler) ou le rappel « sans prochaine action » avec « Planifier une Relance » (point d'attention : élément fragile dans le prototype)
- [ ] Relancer… (`F`) : note de la Relance et dernière Interaction sortante, date et note modifiables, récapitulatif « +1 à l'Activité » ; la Relance devient une Interaction faite, datée du jour saisi (dates passées permises, jour local depuis la date saisie)
- [ ] Reporter (demain, +3 j, +7 j) et Annuler la Relance
- [ ] Le résumé porte la Relance planifiée de chaque Contact et ce qu'il faut pour calculer l'Activité du jour ; gestes testés (nominal + Annuler)
