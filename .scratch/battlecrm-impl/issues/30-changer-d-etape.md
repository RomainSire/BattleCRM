# 30: Changer d'Étape

**What to build:** l'Utilisateur fait avancer ou reculer un Contact En prospection d'Étape par une fenêtre de conséquences (pastille d'Étape de la fiche, `E`) qui règle l'Essai en cours, propose d'enchaîner sur le geste central si l'Étape d'arrivée a une Battle ouverte, signale un recul, et propose « Ajouter au Cercle » après un Succès à la dernière Étape. Sources : spec UX §6.6, §6.2 (Et ensuite) ; CONTEXT (Funnel, Étape, Taux de passage) ; ADR 0003 ; ST-33.

**Blocked by:** 29, 19

**Status:** ready-for-agent

- [ ] Changement d'Étape enregistré comme Interaction (ni sortante ni entrante) avec les positions de départ et d'arrivée dans l'ordre du Funnel du moment
- [ ] Essai en cours : rappel du Critère, Succès proposé si le Contact avance, Laisser en cours s'il recule ; Essai réglé → « Annuler la Relance n planifiée » (cochée)
- [ ] Battle ouverte à l'arrivée → « Enchaîner : utiliser un Positionnement maintenant » (cochée) ; sinon une ligne sur les Positionnements disponibles
- [ ] Dernière Étape : un Succès propose « Ajouter au Cercle » (présélectionné) ou « Rester En prospection à <Étape> » ; même proposition dans « A répondu… » (« Avancer à <suivante> si Succès »)
- [ ] Le Tirage réservé tombe quand le Contact quitte l'Étape ; seul un Contact En prospection change d'Étape
- [ ] Geste testé (nominal + Annuler) ; réordonner le Funnel ensuite ne change pas le sens lu d'un changement passé
