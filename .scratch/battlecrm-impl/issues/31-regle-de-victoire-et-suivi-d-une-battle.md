# 31: Règle de victoire et suivi d'une Battle

**What to build:** sur l'écran Battles, chaque Battle ouverte dit où elle en est par une phrase et une jauge (« X a n % de chances de faire mieux que Y, il en faut 85 % », « trop tôt », « concluante », « Horizon atteint ») ; son panneau a les onglets Suivi, Essais (issue modifiable en ligne), Par Cible et Historique. Sources : spec UX §5.5 ; CONTEXT (Règle de victoire, Horizon) ; ADR 0001, 0012 ; ST-45.

**Blocked by:** 28

**Status:** ready-for-agent

- [ ] `evaluateWinRule(counts, threshold, horizon)` dans `packages/domain` : calcul exact sur deux lois Bêta (pas de Monte-Carlo), minimum 10 Essais terminés par Positionnement et 5 succès au total, Horizon sur les Essais commencés hors annulés ; tests de valeurs de référence et fast-check
- [ ] Phrase selon l'état, équivalent textuel de la jauge (décorative) ; jauge grisée, hachurée, « indicatif » sous le minimum
- [ ] Ligne de l'onglet Battles : mini-jauge, « n+n terminés · n succès », état ou « Clôturer… » (concluante ou Horizon atteint)
- [ ] Suivi : bandeau, progression (terminés vers 10, commencés vers l'Horizon, succès vers 5), Critère, Cible, seuil, Horizon, date ; Essais : issue modifiable tant que la Battle est ouverte (geste annulable) ; Par Cible « à titre indicatif »
- [ ] Point teal « Battle concluante » sur l'entrée Battles de la navigation
