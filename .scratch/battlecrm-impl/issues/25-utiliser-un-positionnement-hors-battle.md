# 25: Utiliser un Positionnement hors Battle

**What to build:** le geste central sans Battle : depuis la fiche (`U`), l'Utilisateur ouvre « Envoyer à <Contact> », choisit le Positionnement de l'Étape, copie le texte avec le prénom remplacé et télécharge les pièces jointes, confirme la date d'envoi ; l'utilisation est enregistrée comme Action de prospection, sans Essai, et la Relance 1 est planifiée. Le Tirage et l'Essai arrivent au ticket 28. Sources : spec UX §6.1 ; CONTEXT (Positionnement, Essai, Action de prospection) ; prototype `prototype/02-utiliser-positionnement` (A2) ; ST-36, ST-60.

**Blocked by:** 21, 23, 19

**Status:** ready-for-agent

- [ ] Panneau en trois temps (Quoi envoyer, Envoie-le, Confirme) ; « C'est envoyé » (`Entrée`) ou « Plus tard » ; notification avec « Annuler »
- [ ] Copier le message (`{prénom}` remplacé) par l'API Clipboard, calculé localement
- [ ] Date d'envoi (aujourd'hui, hier, autre) ; récapitulatif : « sans Essai », Relance 1 à sa date (« déjà en retard » si besoin, lien « modifier »), +1 à l'Activité du jour de l'Interaction
- [ ] Garde-fous : Vivier ou Archivé (« Faire entrer et continuer » par défaut, ou « Enregistrer sans Essai ») ; Allié (sans Essai, remet ses Jours sans contact à 0) ; Étape sans Positionnement (geste bloqué : « Créer un Positionnement pour cette Étape » ou « Noter une Interaction libre »)
- [ ] Bloc Prochaine action : sans Relance ni Essai → « Utiliser un Positionnement »
- [ ] `Ctrl Entrée` dans l'ajout rapide : ajoute En prospection puis enchaîne sur ce geste ; « Créer et l'envoyer à <Contact> » depuis l'atelier
- [ ] Test nominal + Annuler (l'Interaction et la Relance planifiée disparaissent)
