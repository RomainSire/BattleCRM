# 17: Modifier le Contact

**What to build:** l'Utilisateur modifie les Coordonnées d'un Contact sur place, partout où le bloc apparaît, avec les mêmes contrôles de doublons qu'à l'ajout et l'annonce de ce que change un changement d'Organisation ; puis « Annuler ». Sources : spec UX §6.12 ; CONTEXT (Contact) ; ST-64.

**Blocked by:** 16

**Status:** ready-for-agent

- [ ] Édition sur place : nom (seul obligatoire), poste, Organisation (liste filtrée, création avec son type, « Aucune Organisation »), e-mail, téléphone, URL LinkedIn, note ; `Entrée` enregistre (champ d'une ligne), `Échap` annule
- [ ] URL LinkedIn d'un autre Contact → enregistrement bloqué ; même nom, e-mail, téléphone → information
- [ ] Changement d'Organisation : « Ce qui change » (nouvelle Cible, l'Essai en cours garde sa Cible, aucune Interaction enregistrée, Organisation créée le cas échéant)
- [ ] Geste annulable (test nominal + Annuler) ; l'Étape et l'État n'y figurent pas
