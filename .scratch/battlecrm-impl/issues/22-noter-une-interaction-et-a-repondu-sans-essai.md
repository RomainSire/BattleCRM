# 22: Noter une Interaction et A répondu… sans Essai

**What to build:** l'Utilisateur note une Interaction sortante libre (appel, rencontre, message hors Positionnement, autre), ou enregistre qu'un Contact a répondu, sans nature positive ou négative ; pour un Contact du Vivier ou Archivé, la réponse propose de le faire entrer ou de l'ajouter au Cercle ; pour un Allié, ses Jours sans contact repartent. Sources : spec UX §6.2 (réponse spontanée), §6.4 ; CONTEXT (Interaction, Canal) ; ADR 0005 ; ST-36.

**Blocked by:** 21, 19

**Status:** ready-for-agent

- [ ] Noter une Interaction (`I`) : type, date, note, récapitulatif « hors Activité » ; liens vers « A répondu… » et « Utiliser un Positionnement »
- [ ] A répondu… : date, Canal, note facultative ; jamais de nature ; « Enregistrer la réponse » (`Entrée`)
- [ ] Réponse spontanée : Vivier ou Archivé → « Laisser au Vivier » / « Laisser archivé » (présélectionné), « Faire entrer » (Étape et enchaînement comme au ticket 19) ou « Ajouter au Cercle » ; Allié → aucun choix d'État, lien « Planifier une Relance… »
- [ ] « Et ensuite » : « Annuler la Relance planifiée » (cochée) ou « Planifier une Relance… »
- [ ] Le résumé porte la dernière Interaction faite (sortante ou entrante) ; gestes testés (nominal + Annuler)
