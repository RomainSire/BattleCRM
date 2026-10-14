# 17: Modifier le Contact

**What to build:** l'Utilisateur modifie les Coordonnées d'un Contact sur place, partout où le bloc apparaît, avec les mêmes contrôles de doublons qu'à l'ajout et l'annonce de ce que change un changement d'Organisation ; puis « Annuler ». Sources : spec UX §6.12 ; CONTEXT (Contact) ; ST-64.

**Blocked by:** 16

**Status:** resolved

- [x] Édition sur place : nom (seul obligatoire), poste, Organisation (liste filtrée, création avec son type, « Aucune Organisation »), e-mail, téléphone, URL LinkedIn, note ; `Entrée` enregistre (champ d'une ligne), `Échap` annule
- [x] URL LinkedIn d'un autre Contact → enregistrement bloqué ; même nom, e-mail, téléphone → information
- [x] Changement d'Organisation : « Ce qui change » (nouvelle Cible, l'Essai en cours garde sa Cible, aucune Interaction enregistrée, Organisation créée le cas échéant)
- [x] Geste annulable (test nominal + Annuler) ; l'Étape et l'État n'y figurent pas

## Comments

**2026-10-14, implémentation (agent).**

- **API** : `POST /api/contacts/:id/edit` dans `prospecting`, geste `contact_edited` (migration 0017, qui élargit le CHECK de `gesture.kind`). Toutes les Coordonnées à la fois : un champ absent ou vide est vidé ; l'Étape et l'État ne sont pas lus. Organisation existante, nouvelle avec son type, ou aucune (`chosenOrganization`, partagé avec l'ajout) ; aucune Interaction. URL LinkedIn tranchée par l'index unique, dans un savepoint pour lire ensuite le Contact qui la porte (409 `linkedin_url_taken`) ; 404 `not_found` pour un Contact d'un autre Utilisateur ou inconnu (ajouté au test d'accès croisé, qui sait maintenant envoyer un corps valide).
- **« Annuler »** : l'inverse restaure les Coordonnées d'avant et retire l'Organisation créée si aucun Contact ne l'a rejointe. Un inverse peut maintenant répondre `superseded` sans rien écrire, quand un geste sur un autre Contact a ôté ce qu'il faudrait restaurer (Organisation disparue, URL LinkedIn reprise) ; la ligne `gesture` n'est supprimée qu'après l'inverse. `gestures` exporte `lockContact`, pris d'abord par un geste qui lit le Contact avant de l'écrire, dans le même ordre que l'annulation. Spec stack §5.2 et §5.4 mises à jour.
- **SPA** : bouton « Modifier » sur le bloc Coordonnées (page, onglet Détails du panneau, page mobile), actif une fois la note lue ; formulaire sur place (`contacts/edit-coordinates.tsx`) avec les contrôles de doublons de l'ajout, mis en commun dans `contacts/duplicate-notes.tsx` ; « Aucune Organisation » en tête de la liste filtrée (`OrganizationField offersNone`) ; « Ce qui change » dès que l'Organisation change. `Entrée` enregistre (rien n'est envoyé si rien n'a changé), `Échap` annule sans fermer le panneau ; une liste d'Organisations ouverte se ferme d'abord. Le focus revient sur « Modifier ». `applySummaryChanges` relit la fiche (la note) des Contacts qu'un geste ou son annulation a changés.
- **Laissé aux tickets suivants** : la ligne « L'Essai en cours garde sa Cible de départ » s'affiche pour tout Contact En prospection, faute d'Essais ; le ticket 28 la restreindra à un Contact qui en a un.

