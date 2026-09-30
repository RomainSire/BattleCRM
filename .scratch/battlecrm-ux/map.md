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
- [Vocabulaire anglais de l'interface](issues/06-vocabulaire-anglais.md) : anglais US, une ligne `_EN_` par terme dans `CONTEXT.md`. Choix clés : Positioning, Trial (issue *No result* pour sans suite), Follow-up (*Overdue*) contre Response window (*Window elapsed*), Stage, Status avec *Dropped* plutôt que *Closed* (contresens avec closed-won), Target contre Activity goal, *Draw*, Takeaway.
- [Direction visuelle](issues/07-direction-visuelle.md) : sobre et dense, gris-zinc. Le rose → orange est abandonné (trop « alerte ») : accent **teal**, succès dans une variable à part en **vert franc**, retards en ambre, neutre en gris, jamais de rouge. Un seul bouton plein par écran. Contraste WCAG AA non négociable dans les deux thèmes. Thème qui suit le système, modifiable. Logo recoloré en dégradé teal. Confettis fins, coupés si l'Utilisateur a demandé de réduire les animations.
- [Écrans d'indicateurs et d'Activité](issues/09-ecrans-indicateurs-activite.md) : un écran dédié « Indicateurs » (entrée de navigation), période au choix. En tête quatre chiffres d'effort, puis Activité (graphe 12 mois, Objectif du jour au survol, totaux hebdo sans objectif) et Funnel (passages par Étape, **Taux de passage** en second plan, archivées sur demande, entrées par semaine). Funnel sans indicateurs ; rien de plus sur mobile.
- [Enregistrer une réponse du Contact](issues/10-enregistrer-reponse-contact.md) : panneau latéral en 3 étapes (Sa réponse, L'Essai, Et ensuite) avec récapitulatif. Aucune nature positive/négative : l'Essai se règle au regard du Critère de succès, sans présélection ; clore proposé après Sans suite (Garder actif par défaut). Relance annulée par défaut, Étape « avancer si Succès », enchaînement sur le geste central si Battle ouverte à l'arrivée. Une Interaction entrante arrête la Cadence ; le Délai de réponse court depuis elle.
- [Relance faite : aide-mémoire du message](issues/11-relance-faite-aide-memoire.md) : un message facultatif par rang de Cadence, figé avec le Positionnement et comparé dans la Battle ; la Relance le lit depuis la dernière utilisation, sans y être liée. Une Relance peut porter une note, qui reste sur l'Interaction. Action unique « Relancer… » (remplace « Faite » et « J'ai relancé ») : panneau en 2 étapes (Envoie-le, Confirme), `F` puis `Entrée`, retouches du texte non tracées.
- [Parcours mobile](issues/08-parcours-mobile.md) : barre d'onglets (Aujourd'hui, Contacts, Funnel, Plus), bouton + flottant, loupe comme palette. Les panneaux du bureau deviennent une feuille plein écran, étapes empilées et bouton collé en bas ; on copie le message et on change d'app soi-même. Funnel en liste par Étape ; Battles et Indicateurs consultables ; Positionnements, ouverture de Battle et édition du Funnel sur ordinateur seulement. Stack : installation sur l'écran d'accueil, hors-ligne en consultation seulement.
- [Fiche Contact](issues/12-fiche-contact.md) : page depuis Contacts, la palette ou un lien, panneau latéral depuis le Funnel et « Aujourd'hui » (même contenu, « Ouvrir en page »), page empilée sur mobile. Relance planifiée en tête du fil, Essai en cours et Coordonnées à côté. Un seul bouton plein selon la situation. Les gestes tranchés ouvrent leurs panneaux. « Noter une Interaction » sortante seulement, hors Activité, décale la Relance de la Cadence. Au plus une Relance planifiée (« Modifier la Relance »).

## Pas encore spécifié

- **Exigences pour la stack** : s'accumulent au fil des tickets (par exemple la persistance du choix kanban/table, le glisser-déposer, l'installation sur l'écran d'accueil du téléphone, un hors-ligne en consultation seulement (« Aujourd'hui », fiches, copie du message ; aucune action enregistrée), le presse-papiers, le téléchargement des pièces jointes, l'annulation juste après un enregistrement, la préférence de célébration et le fait qu'elle a déjà eu lieu ce jour-là, la préférence de thème Système / Clair / Sombre, la préférence « réduire les animations », des couleurs en jetons pour garantir le contraste AA, l'agrégation de l'Activité par jour dans le fuseau de l'Utilisateur, l'Objectif en vigueur conservé par jour, le Taux de passage calculé sur l'ordre du Funnel en vigueur à chaque changement d'Étape), à consolider dans la spec.

## Hors périmètre

- Choix de stack, architecture du code, déploiement : wayfinder stack à venir.
- Maquettes haute fidélité et design system détaillé.
- Import de Contacts et extension Firefox LinkedIn : fonctionnalités futures.
- Notifications push et e-mail comme **solutions** (le besoin, lui, s'exprime en exigence pour la stack).
- Administration (ouverture des inscriptions pilotée par variable d'environnement).
