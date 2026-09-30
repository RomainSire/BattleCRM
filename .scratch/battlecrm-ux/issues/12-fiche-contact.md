# Fiche Contact

Type: prototype
Status: resolved
Blocked by: 

## Question

À quoi ressemble la fiche Contact, sur bureau et sur mobile, et comment ses actions s'y articulent-elles ?

À trancher :
- Le contenu et sa hiérarchie : timeline des Interactions, Essai en cours, Relance planifiée (avec sa note), Étape et État, Organisation.
- La place du mode **sortant** de « Noter une Interaction » (appel, rencontre hors Positionnement), à côté de « A répondu… », son mode entrant.
- « Planifier une Relance » (date libre, note facultative affichée au moment de relancer).
- La forme de la fiche : page, panneau latéral par-dessus le Funnel, ou les deux selon le point d'entrée ?

Déjà tranché ailleurs, à respecter : le geste central s'y déclenche (bouton, touche `U`) et ajoute son Interaction en tête de la timeline (ticket « Geste central : utiliser un Positionnement ») ; « A répondu… » y ouvre le même panneau que depuis une Relance (ticket « Enregistrer une réponse du Contact ») ; « Relancer… » aussi (ticket « Relance faite : aide-mémoire du message ») ; changer d'Étape ou d'État passe par la même fenêtre de conséquences que le Funnel et les actions reprennent celles des cartes (ticket « Vue Funnel : kanban et table »). Sur mobile, c'est depuis la fiche qu'on change d'Étape, et les panneaux s'ouvrent en feuille plein écran (ticket « Parcours mobile »).

## Assets

- Prototype jetable (variantes A « Page », B « Panneau », C « Parcours » ; cas Essai en cours, sans prochaine action, clos ; largeur mobile ; état affiché) : branche `prototype/12-fiche-contact`, fichier `.scratch/battlecrm-ux/prototypes/12-fiche-contact.html` (`git show prototype/12-fiche-contact:.scratch/battlecrm-ux/prototypes/12-fiche-contact.html > /tmp/p.html`, puis `?variant=A`).

## Answer

Tranché avec Romain le 2026-09-30, sur le prototype.

**Forme : une page (A) et un panneau (B), même contenu, avec la Relance planifiée en tête du fil (repris de C).**
- Depuis le **Funnel** et **« Aujourd'hui »**, la fiche s'ouvre en **panneau latéral** par-dessus la liste, qui reste en contexte. Le panneau commence par un bloc **« Prochaine action »** (la Relance planifiée, ou l'Essai en attente, ou « Sans prochaine action », ou « Hors prospection » pour un Contact non actif), avec le bouton plein et `⋯` ; puis « Noter une Interaction », et des onglets **Fil / Détails**. Un lien **« Ouvrir en page »** mène à la page.
- Depuis **Contacts**, la **palette** ou un lien, la fiche est une **page** qui a sa propre adresse. En-tête : nom, Organisation et Cible, lien LinkedIn, pastilles Étape et État (cliquables, elles ouvrent la fenêtre de conséquences du Funnel), puis les actions. Deux colonnes : le **fil** à gauche ; à droite, **« Essai en cours »** (Positionnement, Battle, Champion ou Challenger, Critère de succès, durée, « A répondu… ») et **« Coordonnées »** (Organisation, Cible, LinkedIn, Étape, État et motif, « Modifier »). Pas de carte « Prochaine Relance » à droite : elle ferait doublon avec la tête du fil.
- **En tête du fil**, en élément « futur » distinct : la Relance planifiée avec son rang (ou « hors Cadence »), son signal (en retard, aujourd'hui, dans n j), sa note, et les actions Relancer… / Modifier / Annuler. Sans Relance ni Essai, un rappel « sans prochaine action » avec « Planifier une Relance ». Puis les Interactions, de la plus récente à la plus ancienne : sortantes, entrantes, et changements d'Étape ou d'État en discret. **Attention au dev** : cet élément de tête était fragile dans le prototype.
- On a écarté C comme forme (frise des Étapes, zone de saisie en tête du fil).

**Un seul bouton plein, selon la situation** (même ordre de priorité qu'« Aujourd'hui ») :
- Relance du jour ou en retard → **Relancer…** (`F`) ;
- Essai « délai dépassé » → **Sans suite…** (avec la proposition de clore, comme sur « Aujourd'hui ») ;
- ni Relance planifiée ni Essai en cours → **Utiliser un Positionnement** (`U`) ;
- en attente (Relance à venir ou Essai en cours) → **A répondu…** ;
- en pause, clos ou gagné → **Réactiver…**.
Les autres actions sont en boutons secondaires sur la page, sous `⋯` dans le panneau : Utiliser un Positionnement, A répondu…, Noter une Interaction (`I`), Planifier / Modifier la Relance (`P`), Changer d'Étape…, Changer d'État…, Modifier le Contact.

**Les gestes déjà tranchés ouvrent leurs propres panneaux, tels quels.** Le prototype les simulait d'un clic, volontairement : sur la fiche, « A répondu… » ouvre le panneau en 3 étapes (Sa réponse, L'Essai, Et ensuite ; ticket « Enregistrer une réponse du Contact »), « Relancer… » le panneau en 2 étapes (Envoie-le avec le message à copier, puis Confirme ; ticket « Relance faite : aide-mémoire du message »), « Utiliser un Positionnement » le panneau du geste central, et changer d'Étape ou d'État la fenêtre de conséquences du Funnel.

**« Noter une Interaction » : sortant seulement.** Panneau court : le type (Appel, Rencontre, Message hors Positionnement, Autre ; pas de champ canal), la date (aujourd'hui, hier, une autre, qui peut précéder la saisie), une note, puis le récapitulatif. Des liens y renvoient vers « A répondu… » (tout l'entrant passe par là, qui règle l'Essai et la Cadence) et vers « Utiliser un Positionnement ». Même geste depuis la fiche, le bouton + et la palette. Conséquences affichées :
- elle **ne compte pas dans l'Activité** (ce n'est pas une Action de prospection) et laisse l'Essai en cours ;
- elle **décale la Relance planifiée par la Cadence**, puisque chaque intervalle se compte depuis la dernière Interaction sortante faite (ex. : appel le 30 sept. → Relance 2 du 30 sept. au 7 oct.). Pas de case pour l'empêcher ; garder l'ancienne date se fait ensuite par « Modifier la Relance » (écart tracé).

**« Planifier une Relance » : au plus une Relance planifiée par Contact** (consigné dans `CONTEXT.md`, définition de Relance). Date (demain, +3 j, +7 j, +14 j, ou une date), note facultative affichée au moment de relancer, récapitulatif. Quand une Relance existe, le geste devient **« Modifier la Relance »** : elle garde son rang et son message ; changer sa date pendant un Essai est un écart tracé sur l'Essai. Une Relance planifiée à la main quand il n'y en a pas est hors Cadence, sans message, seulement la note.

**Mobile** : la fiche est toujours une page. Les blocs s'empilent dans l'ordre Essai en cours, Coordonnées, puis le fil (Relance planifiée en tête). Une barre collée en bas porte le bouton plein, « Noter » et `⋯` (Changer d'Étape…, Changer d'État…, Planifier une Relance, Modifier le Contact). Les panneaux s'ouvrent en feuille plein écran (ticket « Parcours mobile »).

**Renvois** : la saisie de l'Organisation et le repérage des doublons dans « Modifier le Contact » relèvent du ticket « Organisations ».
