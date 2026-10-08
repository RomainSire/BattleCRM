# 14: Étapes types et ajout En prospection ou Allié

**What to build:** un nouveau compte a les quatre Étapes types dans sa langue d'inscription ; l'ajout rapide propose l'État Vivier · En prospection · Allié, et un Contact ajouté En prospection entre dans le Funnel à l'Étape choisie, ce qui compte comme une Entrée dans le Funnel. Sources : spec UX §5.8 (Étapes types), §6.8 ; CONTEXT (État, Entrée dans le Funnel, Funnel) ; ADR 0003, 0007 ; ST-37, ST-39, ST-49.

**Blocked by:** 13

**Status:** ready-for-agent

- [ ] Module `funnel` : table des Étapes (nom, But, ordre, archivage) ; `stageOrder(tx)` exporté
- [ ] À la création du compte (ticket 06) : Approche, Qualif ESN, Qualif Client, Closing avec leur But, en FR ou EN selon la langue de la tentative, textes Paraglide, jamais traduits ensuite
- [ ] Ajout rapide : commande segmentée Vivier · En prospection · Allié, Vivier par défaut, jamais retenue ; Étape visible pour En prospection seulement, la première non archivée par défaut
- [ ] Historique des changements d'État (État de départ et d'arrivée, motif, dernière Étape atteinte, date de saisie depuis l'horloge, jamais antidaté), enregistré comme Interaction ; la dernière Étape atteinte est conservée sur le Contact
- [ ] Entrée dans le Funnel datée du jour local de son enregistrement ; « Annuler » ne laisse aucune Entrée
- [ ] Le résumé porte l'État et l'Étape de chaque Contact, et les Étapes
