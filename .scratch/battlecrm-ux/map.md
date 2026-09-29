# Carte : BattleCRM — UX

Label: wayfinder:map

## Destination

Une **spec UX** (`.scratch/battlecrm-ux/spec.md`) : inventaire des écrans, parcours clés, navigation, comportements, direction visuelle, et une section **Exigences pour la stack**. Elle s'appuie sur des prototypes basse fidélité liés en assets là où « à quoi ça ressemble » est la vraie question. Elle doit être prête à alimenter le wayfinder stack, puis le découpage en tickets d'implémentation.

## Notes

- Domaine : CRM de prospection pour développeurs freelance, fondé sur l'A/B testing de Positionnements. Modèle verrouillé par la carte [BattleCRM](../battlecrm/map.md) : `CONTEXT.md` + `docs/adr/` font foi, en utiliser strictement le vocabulaire.
- Skills à consulter : `grilling` + `domain-modeling` par défaut ; `prototype` pour les tickets de ce type (prototypes jetables, basse fidélité, liés depuis le ticket).
- **Planification uniquement** : on tranche l'UX, on ne code pas l'app. Aucune décision de techno ici : un besoin à cheval (hors-ligne, PWA, notifications, persistance d'une préférence) s'écrit comme **exigence pour la stack**, sans solution.
- La V1 était un POC « vibe codé », jamais utilisé : aucun acquis UX à en reprendre, on part de zéro.
- Exigences produit héritées : plus ergonomique et plus rapide au quotidien qu'Excel/Notion/Airtable ; aider à se détacher des réponses négatives.
- Acquis du cadrage (2026-09-27) :
  - Fidélité : spec + wireframes basse fidélité ciblés, pas de haute fidélité. La direction visuelle est fixée (ton, densité, clair/sombre), pas le design system détaillé.
  - Périmètre : tout le modèle de domaine, les écrans d'indicateurs et d'Activité, les parcours d'inscription/connexion et les réglages (Funnel, Objectif d'activité, Cadence par défaut).
  - **PC = poste principal**, **mobile = usage rapide** (Relances du jour, enregistrer une Interaction ou une Relance faite, régler un Essai), avec un vrai parcours mobile pour ces actions : desktop-first, mais pas un simple « responsive par défaut ».
  - Écran d'accueil = **« Aujourd'hui »** (Relances dues ou en retard, Essais « délai dépassé », Battles concluantes, Activité du jour face à l'Objectif).
  - Funnel : vues kanban **et** table ; kanban par défaut, le dernier choix de l'Utilisateur est retenu.
  - Termes du glossaire affichés **tels quels** à l'écran ; interface **bilingue français/anglais** (i18n dès le départ).
  - **Pas d'assistant d'onboarding** : Funnel pré-rempli avec des Étapes types modifiables, plus des états vides qui se suffisent à eux-mêmes (« si l'UX doit s'expliquer, elle est ratée »).
  - **Clavier d'abord** : palette de commandes et ajout rapide global (Contact, Interaction).
  - Battle : phrase en langage naturel, jauge vers le seuil, progression vers le minimum d'Essais et l'Horizon ; jamais de distribution brute par défaut.

## Decisions so far

<!-- une ligne par ticket résolu -->

- [Écran « Aujourd'hui »](issues/01-ecran-aujourdhui.md) : tableau de bord par blocs sur bureau, « une chose à la fois » sur mobile. Priorité : Relances en retard, Relances du jour, Essais délai dépassé, Battles concluantes. Actions directes (dont « A répondu… » et proposition de clore après un Essai sans suite), bloc « sans prochaine action » limité, états vides sans assistant.
- [Geste central : utiliser un Positionnement](issues/02-geste-utiliser-positionnement.md) : la proposition d'abord, dans un panneau latéral en 3 étapes (Quoi envoyer, Envoie-le, Confirme, avec un récapitulatif des conséquences). Dérogation au tirage avec motif optionnel, tirage réservé au Contact, Relance 1 affichée et modifiable, garde-fous traités dans le panneau, même panneau depuis tous les déclencheurs.
- [Vue Funnel : kanban et table](issues/03-vue-funnel-kanban-table.md) : kanban en couloirs (colonnes = Étapes ; lignes À traiter, mise en avant, puis En attente et Sans prochaine action), tri par urgence, raccourcis d'action sur les cartes identiques à ceux d'« Aujourd'hui ». Glisser-déposer bloquant : une fenêtre règle l'Essai en cours (Succès proposé si le Contact avance) et enchaîne par défaut sur le geste central si l'Étape d'arrivée a une Battle ouverte. Pause, clos et gagnés masqués derrière un filtre d'État ; vue table commune ; ajout rapide où seul le nom est obligatoire.
- [Écran Battle et Historique des Champions](issues/04-lisibilite-battle.md) : vue d'ensemble des Battles, une ligne par Étape avec mini-jauge et phrase, détail dans un panneau latéral (Suivi, Essais, Par Cible, Historique). Jauge grisée « indicatif » avant le minimum. Ouverture par un assistant en 3 étapes, clôture par une fenêtre au Verdict présélectionné (vainqueur contre la règle confirmé après avertissement, Enseignement facultatif). Historique des Champions en lignées par Étape : prouvé en fond plein, désigné hachuré.
- [Détachement des réponses négatives dans l'UX](issues/05-detachement-reponses-negatives.md) : tutoiement, registre factuel (« un point de donnée de plus », progression de la Battle), jamais d'encouragement ni de rouge. Les clôtures s'annoncent par le nouveau Champion. Les taux n'apparaissent que comme comparaison entre Positionnements, aucune détection de série. Célébration une fois par jour au franchissement de l'Objectif (« Bravo », confettis brefs, sans paliers, désactivable). Graphe d'Activité codé par intensité seule, sans compteur de série.

## Pas encore spécifié

- **Fiche Contact** : timeline des Interactions, Essai en cours, Relance planifiée, Étape et État, Organisation. Le geste central s'y déclenche (bouton, touche `U`) et y ajoute son Interaction en tête ; changer d'Étape ou d'État y passe par la même fenêtre de conséquences que le Funnel, et ses actions reprennent celles des cartes.
- **Navigation globale** : structure des menus, place de la palette de commandes, entre desktop et mobile. « Aujourd'hui » est l'écran d'arrivée ; « Battles » est un écran à deux onglets (Battles, Historique des Champions) ; le reste dépend de l'inventaire des écrans.
- **Gestion des Positionnements** : création, dérivation d'un Positionnement existant, pièces jointes, Cadence de relance, consultation des archivés. Le Champion initial se désigne déjà dans l'assistant d'ouverture d'une Battle ; son lien « + Créer un Positionnement » doit mener ici et revenir à l'assistant.
- **Réglages** : édition du Funnel (ajout, renommage, réordonnancement, archivage et restauration d'Étapes avec leurs garde-fous), Objectif d'activité, interrupteur « Célébrer l'Objectif atteint », Cadence par défaut, langue, thème.
- **Organisations** : écran propre ou simple attribut du Contact ? Repérage des doublons (URL LinkedIn).
- **Parcours d'authentification** : inscription (ouverte ou fermée selon la configuration), connexion, mot de passe oublié.
- **Accessibilité** : niveau visé (contrastes, navigation clavier complète, lecteurs d'écran).
- **Exigences pour la stack** : s'accumulent au fil des tickets (par exemple la persistance du choix kanban/table, le glisser-déposer, une notification de Relance en retard, un hors-ligne mobile éventuel, le presse-papiers, le téléchargement des pièces jointes, l'annulation juste après un enregistrement, la préférence de célébration et le fait qu'elle a déjà eu lieu ce jour-là), à consolider dans la spec.

## Hors périmètre

- Choix de stack, architecture du code, déploiement : wayfinder stack à venir.
- Maquettes haute fidélité et design system détaillé.
- Import de Contacts et extension Firefox LinkedIn : fonctionnalités futures.
- Notifications push et e-mail comme **solutions** (le besoin, lui, s'exprime en exigence pour la stack).
- Administration (ouverture des inscriptions pilotée par variable d'environnement).
