# Écran Contacts et « Modifier le Contact »

Type: prototype
Status: resolved
Blocked by: 

## Question

Que montre l'écran « Contacts » (entrée du menu bureau, onglet mobile), et comment se présente le formulaire « Modifier le Contact » ?

Déjà tranché : la fiche Contact s'ouvre en page depuis Contacts (ticket [Fiche Contact](12-fiche-contact.md)) ; la fiche en page et la page Organisation allument l'entrée Contacts, avec un fil d'Ariane (ticket [Navigation globale](17-navigation-globale-bureau.md)) ; l'Organisation se choisit dans une liste filtrée à la frappe, et les doublons de Contact se vérifient pendant la frappe (ticket [Organisations](15-organisations.md)) ; un nouveau Contact peut entrer à une Étape choisie (`CONTEXT.md`, entrée Contact).

À trancher :
- **Écran Contacts** : liste, colonnes, recherche, filtres et tri ; place des Contacts en pause, clos et gagnés ; différence avec la vue table du Funnel, qui montre déjà tous les Contacts (doublon assumé, ou écran distinct : annuaire contre outil d'action ?).
- **Mobile** : la liste de l'onglet Contacts (recherche en tête, ordre, contenu d'une ligne).
- **Modifier le Contact** : champs (nom, Organisation, URL LinkedIn, autres coordonnées ?), forme (panneau, édition sur place dans « Coordonnées »), effets affichés (changement de Cible, Essai en cours qui garde la sienne).
- États vides et premier jour.

## Answer

Tranché avec Romain le 2026-10-01, sur le prototype (branche `prototype/19-ecran-contacts`, fichier `.scratch/battlecrm-ux/prototypes/19-ecran-contacts.html`, `?variant=B`). Variantes écartées : A « Annuaire » (table par nom, sans aucune action de prospection) et C « Table du Funnel » (même composant que la vue table, avec des vues enregistrées). Il y a bien un écran distinct de la vue table du Funnel : on y cherche **une personne**, puis on agit sur elle. Le Funnel, lui, montre où en est la prospection.

**Écran Contacts : une liste à gauche, la fiche à droite.**
- **Liste** : recherche en tête (nom, Organisation, poste, e-mail), puis les puces d'État **Tous** (par défaut), Actifs et Hors prospection. Les Contacts en pause, clos et gagnés figurent dans « Tous », en grisé. Tri : la dernière Interaction d'abord, sans autre tri. Une ligne porte l'initiale, le nom, « Organisation · Étape » (« Sans Organisation » à défaut), le signal de prochaine action (Relance en retard ou du jour, Essai en cours, délai dépassé, Relance à venir, « Sans prochaine action », ou l'État et son motif), et la date de la dernière Interaction.
- **Volet droit** : c'est **le panneau de la fiche Contact** (ticket [Fiche Contact](12-fiche-contact.md)), ancré à droite au lieu de flotter au-dessus de la liste. Il garde le bloc Prochaine action, le bouton plein, `⋯`, les onglets Fil / Détails et « Ouvrir en page ». Changer de ligne remplace son contenu. Une seule forme de fiche en panneau, partout.
- La **page** de la fiche reste accessible par « Ouvrir en page », par la palette et par un lien. Elle allume toujours l'entrée Contacts, avec le fil d'Ariane.
- **Mobile** : la même liste (recherche en tête, puces d'État, mêmes lignes). Toucher une ligne ouvre la fiche en page.
- **État vide** : « Aucun Contact pour l'instant », une phrase (seul le nom est obligatoire, le Contact entre à la première Étape), « Ajouter un Contact » `N`. Une recherche sans résultat dit « Aucun Contact ne correspond ».

**Champs d'un Contact** : nom (seul champ obligatoire), poste, Organisation, e-mail, téléphone, URL LinkedIn, note libre (contexte permanent, distinct des notes d'Interaction). Consigné dans `CONTEXT.md`.

**Modifier le Contact : édition sur place du bloc Coordonnées, partout.** Le bloc Coordonnées existe sur la page de la fiche, dans l'onglet Détails du panneau et dans le volet de Contacts. « Modifier » le transforme en formulaire, là où il se trouve, sans ouvrir de panneau de geste. C'est vrai aussi pour la page de la fiche sur mobile. `Entrée` enregistre dans un champ d'une ligne, `Échap` annule, puis la notification « Annuler » s'affiche.
- **Organisation** : choisie dans la liste filtrée à la frappe, ou créée avec son type, ou « Aucune Organisation » (comme dans le ticket [Organisations](15-organisations.md)).
- **Contrôles pendant la frappe**, tous **non bloquants** sauf un. L'URL LinkedIn déjà portée par un autre Contact **bloque** l'enregistrement (« Ce Contact existe déjà : … », « Ouvrir sa fiche »). Sont signalés pour information seulement : un même nom (plus précis dans la même Organisation), un même e-mail, un même téléphone. Le nom vide empêche d'enregistrer.
- **« Ce qui change »**, affiché avant d'enregistrer dès que l'Organisation change : la nouvelle Cible, le fait que l'Essai en cours garde sa Cible de départ, qu'aucune Interaction n'est enregistrée, et la création d'une Organisation le cas échéant.
- **L'Étape et l'État ne figurent pas dans le formulaire.** Ils passent par « Changer d'Étape… » et « Changer d'État… », c'est-à-dire par la fenêtre de conséquences.

**Supprimer le Contact… : une anonymisation.** Clore ne suffit pas pour deux cas : un Contact saisi par erreur (doublon sans URL LinkedIn, test), et une personne qui demande l'effacement de ses données (RGPD : le Contact est un tiers). L'action se range sous `⋯` dans la fiche (page, panneau, barre mobile). Il n'y a pas de bouton dans la liste.
- **Effet** : le nom, le poste, les coordonnées, la note et les notes de ses Interactions sont effacés définitivement. Ses Essais et Interactions restent, rattachés à « Contact supprimé ». Les Battles, l'Activité et le Taux de passage sont inchangés. Son Essai en cours passe **annulé** (motif « Contact supprimé »), sa Relance planifiée est annulée, et son URL LinkedIn redevient libre. Le Contact supprimé n'apparaît plus ni dans Contacts, ni dans le Funnel, ni dans la palette. Seuls les Essais des Battles le montrent, sous « Contact supprimé ». Voir l'ADR 0006.
- **Fenêtre de confirmation**, parce que l'effet est irréversible (exception prévue à « annuler plutôt que confirmer ») : « Supprimer <Contact> ? Ses coordonnées et ses notes sont effacées définitivement. Ses n Essais restent dans les Battles, sans son nom. », puis Supprimer ou Annuler. Elle propose de **clore** à la place quand on veut seulement arrêter la prospection.

**Précision (arbitrage du 2026-10-01, consolidation de la spec)** : l'ajout rapide d'un Contact garde ses champs visibles (nom, Organisation, URL LinkedIn, Étape) ; un lien « Plus de champs » déplie le poste, l'e-mail, le téléphone et la note. Ses contrôles de doublons sont ceux de « Modifier le Contact » : URL LinkedIn bloquante ; nom, e-mail et téléphone informatifs.
