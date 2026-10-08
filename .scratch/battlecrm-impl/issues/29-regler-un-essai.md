# 29: Régler un Essai

**What to build:** l'Utilisateur règle l'Essai en cours d'un Contact : dans « A répondu… » (Succès, Sans suite ou Laisser en cours, `1` `2` `3`, sans présélection), depuis un Essai « délai dépassé » (Sans suite, puis la proposition de remettre au Vivier, ou Relancer quand même), et en quittant En prospection. Sources : spec UX §5.3, §6.2, §6.7, §6.11 (quitter En prospection) ; CONTEXT (Essai, Délai de réponse, À traiter) ; ADR 0005 ; ST-34.

**Blocked by:** 28, 26, 22

**Status:** ready-for-agent

- [ ] Signal « délai dépassé » calculé (Cadence épuisée ou arrêtée, Délai de réponse compté depuis la dernière Interaction sortante faite ou entrante) dans `packages/domain`, jamais stocké
- [ ] A répondu… avec Essai : Positionnement, Battle, rappel du Critère, `1` `2` `3`, « Enregistrer la réponse » inactif tant que l'Essai n'est pas réglé ; Laisser en cours fait repartir le Délai de réponse depuis la réponse
- [ ] Sans suite : notification « Essai sans suite : un point de donnée de plus pour la Battle “<Étape>” (14/20 terminés). », puis « Remettre <Contact> au Vivier ? … » (Remettre au Vivier présélectionné, Garder En prospection, Archiver), motif facultatif
- [ ] Relancer quand même : Relance hors Cadence, écart tracé sur l'Essai ; changer la date d'une Relance pendant un Essai est aussi un écart tracé
- [ ] Quitter En prospection (ticket 19) : l'Essai en cours doit être réglé (Succès vers Allié, Sans suite vers Vivier, aucun vers Archivé ; Annulé avec motif)
- [ ] Bloc Prochaine action : Essai délai dépassé → Sans suite… ; en attente → A répondu… ; fiche : bloc Essai en cours
- [ ] Gestes testés (nominal + Annuler)
