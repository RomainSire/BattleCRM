# Écrans d'indicateurs et d'Activité

Type: prototype
Status: resolved
Blocked by: 05

## Question

Quels indicateurs de Funnel et d'Activité montrer, et comment ?

À trancher :
- Funnel : taux de passage entre Étapes, volume de Contacts entrés par semaine, lecture avec les Étapes archivées et réordonnées.
- Activité : graphe journalier façon GitHub, totaux hebdomadaires, Objectif en vigueur chaque jour.
- Emplacement : écran dédié, blocs sur « Aujourd'hui », les deux ?
- Cohérence avec le ton décidé par le ticket de détachement des réponses négatives (effort avant taux).

Données d'entrée (2026-09-29, ticket « Détachement des réponses négatives dans l'UX ») : graphe d'Activité codé par intensité seule (jour vide neutre, pas de marque « Objectif atteint », aucun compteur de série) ; taux de succès seulement comme comparaison entre Positionnements ; taux de passage entre Étapes permis en second plan. Reste à trancher ici : l'emplacement de la vue longue du graphe, et l'existence même d'un écran d'indicateurs.

## Assets

- Prototype jetable (variantes A « Sur place », B « Écran Indicateurs », C « Journal d'Activité ») : branche `prototype/09-indicateurs`, fichier `.scratch/battlecrm-ux/prototypes/09-indicateurs.html` (`git show prototype/09-indicateurs:.scratch/battlecrm-ux/prototypes/09-indicateurs.html > /tmp/p.html`, puis `?variant=B&ecran=indic`), `?variant=A|B|C`, `&ecran=aujourdhui|funnel|indic|activite`.

## Answer

Tranché avec Romain le 2026-09-30, sur le prototype : **variante B « Écran Indicateurs »**. `CONTEXT.md` gagne le terme **Taux de passage** ; pas d'ADR.

**Un écran dédié « Indicateurs »**, avec son entrée dans la navigation. Le bloc Activité d'« Aujourd'hui » garde sa jauge et ses 4 dernières semaines, avec un lien « Indicateurs → ». La vue Funnel reste sans indicateurs : elle sert à agir, l'écran Indicateurs sert à lire. Rejetés : A (panneau depuis « Aujourd'hui » et bandeau sur le Funnel) et C (journal d'Activité jour par jour).

**Période** choisie en tête d'écran : 30 jours, 3 mois, 12 mois, depuis le début. Elle s'applique aux chiffres, aux totaux hebdomadaires et au Funnel.

**En tête, quatre chiffres d'effort** : Actions de prospection de la semaine (avec la semaine précédente pour repère), Actions sur la période (et moyenne par jour), Essais terminés sur la période, Contacts entrés sur la période. Aucun taux en tête.

**Section Activité.**
- Graphe journalier façon GitHub sur 12 mois, selon les bornes du ticket « Détachement des réponses négatives dans l'UX » : intensité seule, jour vide neutre, aucune marque « Objectif atteint », aucune série.
- Au survol d'un jour : date, nombre d'Actions de prospection et **Objectif en vigueur ce jour-là** (« 2 Actions · objectif du jour : 3 »). C'est la seule place où l'Objectif historique apparaît, sans jugement.
- Totaux par semaine en barres, **sans ligne d'objectif** (la semaine n'a pas d'objectif propre). La semaine en cours est atténuée.

**Section Funnel.**
- Barres « Contacts passés par chaque Étape », dans l'ordre actuel du Funnel.
- **Taux de passage** en second plan, sous chaque barre (« ↓ 44 % ont ensuite atteint “CV envoyé” ou plus loin »). Définition ajoutée à `CONTEXT.md` : la part des Contacts arrivés à une Étape qui ont ensuite atteint une Étape plus loin, sauts compris, « plus loin » se lisant dans l'ordre en vigueur au moment du changement.
- **Étapes archivées** masquées par défaut ; une case les affiche à part, en gris, avec leur volume mais sans Taux de passage.
- Contacts entrés par semaine, en petites barres, avec la moyenne.

**Mobile** : pas d'écran Indicateurs dédié au mobile ; les 4 semaines d'« Aujourd'hui » suffisent. Les indicateurs restent un usage PC (l'écran reste accessible et lisible en largeur réduite, sans parcours propre).

**Hérité du prototype, non discuté en détail** : les libellés exacts et la mise en page fine des sections.

**Exigences pour la stack** : agréger l'Activité par jour dans le fuseau de l'Utilisateur, sur 12 mois et plus ; conserver l'Objectif en vigueur de chaque jour ; calculer le Taux de passage à partir de l'historique des changements d'Étape et de l'ordre du Funnel en vigueur à chaque changement ; filtrer ces agrégats par période.
