# 27: Ouvrir une Battle et écran Battles

**What to build:** l'écran Battles liste une ligne par Étape ; sur une Étape sans Battle, « Ouvrir une Battle… » lance un assistant en trois étapes (Champion, ou Champion initial à désigner, contre un Challenger ; Critère de succès ; restriction de Cible, seuil et Horizon figés) qui ouvre la Battle. Sources : spec UX §5.5, §6.9 (ouverture) ; CONTEXT (Battle, Champion, Challenger, Critère de succès, Horizon) ; ADR 0001 ; prototype `prototype/04-battle` (B).

**Blocked by:** 23

**Status:** ready-for-agent

- [ ] Module `battles` : Battle (Étape, Champion, Challenger, Critère de succès, restriction de Cible, seuil 0,85, Horizon 25, date d'ouverture), au plus une Battle ouverte par Étape (index unique partiel, verrou), Champion de l'Étape
- [ ] Assistant : Challenger parmi les Positionnements de l'Étape, archivés compris (« revient comme Challenger »), lien « + Créer un Positionnement » qui revient à l'assistant ; Critère repris de la Battle précédente de l'Étape, sinon du But ; rappel que seuil et Horizon sont figés et que le minimum ne se règle pas ; récapitulatif en une phrase
- [ ] Onglet Battles : « Champion vs Challenger » ou « Pas de Battle. Champion : X » (« ni de Champion ») avec « Ouvrir une Battle… »
- [ ] Un Positionnement Champion ou dans une Battle ouverte n'est pas archivable (atelier, ticket 23)
- [ ] Mobile : consultation ; l'ouverture reste atteignable empilée
- [ ] Geste testé (nominal + Annuler)
