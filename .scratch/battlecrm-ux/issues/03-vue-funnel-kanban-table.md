# Vue Funnel : kanban et table

Type: prototype
Status: resolved
Blocked by: 

## Question

Comment se présentent et se manipulent les Contacts dans le Funnel, en vue kanban (par défaut) et en vue table ?

À trancher :
- Contenu d'une **carte** kanban et **colonnes** de la table : Étape, État, Cible, Essai en cours, prochaine Relance, signaux (en retard, délai dépassé).
- **Changer d'Étape** : glisser-déposer ou action explicite ? Que se passe-t-il quand un Essai est en cours (demande de réglage de l'Essai) et quand l'Étape d'arrivée a une Battle ouverte (enchaîner sur le geste central) ?
- Où apparaissent les Contacts en pause, clos et gagnés (filtres, colonnes masquées, section repliée).
- Filtres et tri : Étape, État, Cible, Battle, Organisation.
- **Ajout rapide** d'un Contact et palette de commandes : les champs minimaux et l'entrée clavier.

## Assets

- Prototype jetable (variantes A, B, C ; vue table commune ; ajout rapide ; palette) : branche `prototype/03-vue-funnel`, fichier `.scratch/battlecrm-ux/prototypes/03-vue-funnel.html` (`git show prototype/03-vue-funnel:.scratch/battlecrm-ux/prototypes/03-vue-funnel.html > /tmp/p.html`, puis `?variant=C`, `&vue=table`).

## Answer

Tranché avec Romain le 2026-09-29, sur le prototype.

**Kanban : des couloirs** (variante C). Les colonnes sont les Étapes, avec dans leur en-tête le nombre de Contacts et la Battle ouverte (Champion et Challenger, Essais sur l'Horizon). Les lignes regroupent les Contacts selon leur prochaine action :
1. **À traiter**, mis en avant visuellement : Relance en retard ou du jour, Essai « délai dépassé », conséquence d'un déplacement restée à régler ;
2. **En attente** : Relance planifiée à venir ou Essai en cours dans les temps ;
3. **Sans prochaine action** : Contact actif sans Relance planifiée ni Essai en cours.

Les couloirs sont calculés : on ne dépose pas un Contact dans un couloir, seulement dans une Étape. **Tri** dans une case : par urgence (Relance en retard la plus ancienne d'abord, puis Relance du jour, puis ce qui reste à régler, le délai dépassé, les Contacts sans prochaine action, enfin par date de Relance). Romain le trouve bien ainsi, sans autre tri proposé.

**Carte** : le nom, l'Organisation et la Cible, puis **la prochaine action** (la Relance et son rang, avec « en retard · n j » ou « aujourd'hui » ; l'Essai en cours et « délai dépassé »), et enfin les **raccourcis d'action** propres à la situation. Les raccourcis reprennent les actions directes de l'écran « Aujourd'hui », pour que le même Contact se traite de la même façon partout :
- Contact **sans prochaine action** : « Utiliser un Positionnement », qui ouvre le panneau du geste central ; en secondaire, « Planifier une Relance ».
- **Relance à faire** (en retard ou du jour) : « J'ai relancé » (Relance faite), puis Reporter, Annuler et « A répondu… ». Ce que le geste montre au moment de relancer (un aide-mémoire du Positionnement, un texte à copier) est renvoyé au ticket « Relance faite : aide-mémoire du message ».
- Essai **délai dépassé** : Sans suite (avec la proposition de clore le Contact), Relancer quand même.
- Partout : le menu `⋯` (changer d'Étape, changer d'État, ouvrir la fiche).

**Changer d'Étape : glisser-déposer bloquant** (le déposer de la variante A). Au dépôt dans une autre Étape, une **fenêtre** règle les conséquences avant de confirmer (`Entrée`) :
- **Essai en cours** : il est rappelé avec son Critère de succès, et on choisit Succès, Sans suite ou Laisser en cours. Le choix proposé est **Succès si le Contact avance** et **Laisser en cours s'il recule**. Si l'Essai est réglé, la case « Annuler la Relance n planifiée » est proposée, cochée par défaut.
- **Battle ouverte à l'Étape d'arrivée** : la case « Enchaîner : utiliser un Positionnement maintenant » est **cochée par défaut**. À la confirmation, le panneau « Envoyer à <Contact> » du geste central s'ouvre directement, avec un Essai éventuellement laissé en cours traité dans ce panneau (garde-fou « Essai en cours ailleurs »).
- **Pas de Battle ouverte à l'arrivée** : une ligne indique les Positionnements disponibles pour l'Étape, sans rien proposer de plus.
- Ensuite, une notification avec « Annuler ». Un retour en arrière est signalé comme tel dans la fenêtre, sans autre différence.

Pendant le glisser apparaissent des **zones d'État** (En pause, Clos, Gagné). Les déposer dessus ouvre la même fenêtre, qui **oblige** à régler l'Essai en cours (Succès, Sans suite, Annulé), avec un motif facultatif pour Clos. Un Contact non actif ne change pas d'Étape tant qu'il n'est pas réactivé. Les alternatives au clavier au glisser-déposer : le menu `⋯` (« Changer d'Étape → … ») et la palette (« Déplacer <Contact> vers… »), qui mènent à la même fenêtre.

**Contacts en pause, clos et gagnés** : ils sont masqués par défaut dans le kanban. Un filtre d'État en haut de la page (actif coché par défaut) permet de les afficher, et une ligne indique ce qui est masqué (« Masqués : 2 en pause, 3 clos, 2 gagnés · Tout afficher »). Une fois affichés, ils sont regroupés dans une ligne « Hors prospection active », sous leur dernière Étape atteinte.

**Vue table** (touche `V`, commune) : Contact, Organisation, Cible, Étape (modifiable en ligne, avec la même fenêtre de conséquences), État (et le motif de clôture), Essai en cours, prochaine Relance (ou « sans prochaine action »), date d'entrée dans l'Étape ; triable par colonne, par urgence par défaut ; même filtre d'État que le kanban.

**Filtres** (communs aux deux vues) : recherche par nom ou Organisation, Cible, Battle (« Essai en cours dans une Battle » ou « Essai « <Positionnement> » »), Organisation, signal (Relance en retard, délai dépassé, sans prochaine action).

**Ajout rapide** (`N`, ou la palette) : seul le nom est obligatoire. L'Organisation est choisie parmi les existantes, ou créée dans la foulée en choisissant son type (ESN, client final), qui définit la Cible. L'URL LinkedIn signale un doublon, et un nom identique à celui d'un Contact existant donne une simple information. L'Étape est pré-remplie avec la première. `Entrée` ajoute le Contact ; `Ctrl Entrée` ajoute et enchaîne sur « Utiliser un Positionnement ».

**Exigences pour la stack** : le glisser-déposer (souris ; le tactile relève du ticket « Parcours mobile ») ; la persistance du choix kanban/table (déjà notée) ; annuler juste après un enregistrement (déjà notée).

**Précision (ticket [Réglages](14-reglages.md))** : un Contact actif dans une Étape qui n'a aucun Positionnement (par ex. le Vivier) ne compte pas comme « sans prochaine action ». Il n'apparaît pas dans « Aujourd'hui » et se range dans « En attente », sans signal.
