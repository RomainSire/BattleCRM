# 19: Changer d'État

**What to build:** depuis la fiche, l'Utilisateur fait entrer un Contact dans le Funnel, le remet au Vivier, l'ajoute au Cercle ou l'archive, par un verbe qui ouvre une fenêtre de conséquences réglée sur sa cible (ou « Changer d'État… » qui commence par le choix de la cible) ; récapitulatif, validation, puis « Annuler ». Le règlement d'un Essai en cours s'y ajoutera au ticket 29. Sources : spec UX §5.3 (bloc Prochaine action selon l'État), §6, §6.11, §10 ; CONTEXT (État) ; ADR 0007 ; ST-39, ST-62, ST-66, ST-70.

**Blocked by:** 16

**Status:** ready-for-agent

- [ ] Panneau de geste réutilisable : modal (focus piégé, `Échap`, focus rendu au déclencheur), feuille plein écran sur mobile (bouton collé en bas, ✕), état conservé au retour dans l'app (`sessionStorage`)
- [ ] Faire entrer… (Vivier, Archivé, Allié → En prospection) : Étape (dernière atteinte par défaut, choix obligatoire si archivée ou absente), récapitulatif « Entrée n°3 cette semaine (3/5) », un Allié garde sa Relance planifiée
- [ ] Ajouter au Cercle…, Remettre au Vivier…, Archiver… : motif facultatif ; Relance planifiée annulée en ligne du récapitulatif quand on quitte En prospection ; récapitulatif « Cercle 8/10 · prochaines nouvelles d'ici le <date> (Rythme 28 j) » (valeurs par défaut tant que le ticket 20 n'est pas fait)
- [ ] Changer d'État… (touche `S`, pastille d'État) : choix de la cible, jamais le verbe de l'État actuel
- [ ] Bloc Prochaine action de la fiche selon l'État : Vivier (« Au Vivier · dernière Étape : … » ou « jamais entré », Faire entrer…), Archivé (fiche grisée, motif, « Rien n'est définitif : tu peux le faire revenir. »), verbes d'État en secondaire ou sous `⋯`
- [ ] Notifications de la spec UX §10 ; « Annuler » supprime le changement d'État et ne laisse aucune Entrée (test)
