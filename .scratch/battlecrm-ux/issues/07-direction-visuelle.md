# Direction visuelle

Type: prototype
Status: resolved
Blocked by: 01

## Question

Quelle direction visuelle donner à l'app : ton, densité d'information, place des couleurs (signaux, Cibles, Positionnements A/B), thème clair/sombre, part de « gamification » ?

Pas de design system détaillé (hors périmètre). La réponse s'appuie sur les prototypes existants (l'écran « Aujourd'hui » au moins) pour réagir sur du concret.

Données d'entrée (2026-09-29) :
- **Logo existant à réutiliser** (aussi pour la favicon), repris de la POC : `BattleCRM_logo.svg` à la racine du repo. C'est une éprouvette en diagonale (icône Lucide `test-tube-diagonal`), tracée en blanc sur un carré arrondi en dégradé **#ff1b6b → #ff930f** (rose vers orange). Romain souhaite en **dériver les couleurs** de l'app.
- Base de réaction : la variante B (tableau de bord) du prototype de l'écran « Aujourd'hui » (branche `prototype/01-aujourdhui`), retenue pour le bureau.
- Du ticket « Détachement des réponses négatives dans l'UX » : succès mis en valeur par la couleur, « sans suite » et clos neutres (gris, jamais rouge ni alerte) ; célébration de l'Objectif (confettis brefs, ~1,5 s, « Bravo ») dont le rendu reste à fixer ici. La part de gamification est déjà bornée : pas de paliers, pas de séries.

## Assets

- Prototypes jetables sur la branche `prototype/07-direction-visuelle` :
  - `.scratch/battlecrm-ux/prototypes/07-direction-visuelle.html` : 1er tour, trois directions (A Sobre, B Chaleureux, C Labo).
  - `.scratch/battlecrm-ux/prototypes/07-direction-visuelle-2.html` : 2e tour, quatre palettes sur la base A (Ultra sobre, Ambre, Indigo, Teal), thème système, contrôle de contraste WCAG calculé en direct (écran « Planche + contrastes »).
  - `git show prototype/07-direction-visuelle:.scratch/battlecrm-ux/prototypes/07-direction-visuelle-2.html > /tmp/p.html`

## Answer

Tranché avec Romain le 2026-09-30, sur deux tours de prototype. Aucun changement de `CONTEXT.md`, pas d'ADR.

**Ton et densité : « Sobre ».** Neutres gris-zinc, interface dense (texte courant ~13 px, police système), arrondis discrets (6 px pour les contrôles, 8 px pour les cartes), cartes à filet fin sans ombre. Les chiffres sont en chiffres tabulaires. Rejetés : la direction « Chaleureux » (crème, grands arrondis, dégradé partout) et la direction « Labo » (sombre d'abord, capitales, chasse fixe).

**Abandon du rose → orange.** Ces couleurs évoquent l'erreur et l'alerte, ce qui contredit le ticket « Détachement des réponses négatives dans l'UX ». Le logo change de couleur (voir plus bas).

**Palette : teal pour l'accent.** Chaque couleur n'a qu'un sens, dans des variables CSS distinctes :

| Rôle | Clair | Sombre | Usage |
|---|---|---|---|
| Accent (teal) | `#0f766e` (bouton plein, texte blanc) | bouton `#2dd4bf` à texte sombre, texte d'accent `#5eead4` | action principale, contour des actions de carte, Challenger, Battle, anneau d'Activité, graphe d'Activité (échelle teal), Champion prouvé dans l'Historique |
| Succès (vert) | `#15803d` | `#4ade80` | Essai en Succès, « Objectif atteint » |
| Retard (ambre) | `#a84d06` | `#f59e0b` | Relances en retard, compteur dans la navigation |
| Neutre (gris) | point `#a1a1aa`, texte `#63636b` | point `#71717a`, texte `#a1a1aa` | « sans suite », en cours, clos, délai dépassé, Champion dans une jauge |

- Le **succès a sa propre variable, en vert franc**, distinct du teal : un bouton ne doit pas ressembler à un Succès (demande de Romain).
- **Pas de rouge** dans l'interface, conformément au ticket « Détachement des réponses négatives dans l'UX ».
- Valeurs de départ, validées pour le contraste ; le design system détaillé reste hors périmètre.

**Discipline des boutons.** **Un seul bouton plein (accent) par écran**, pour l'action principale (ex. « + Contact » sur « Aujourd'hui », « Confirmer » dans une fenêtre). Les actions de ligne sont des boutons neutres, la première en gras (« Faite », « Sans suite », « Utiliser un Positionnement »). Une action de carte qui sort de la routine (« Clôturer… ») porte un contour d'accent. Au 1er tour, un bouton plein par ligne rendait l'écran criard.

**Contraste : WCAG 2.2 AA, non négociable.** 4,5:1 pour tout texte, 3:1 pour les formes et composants (boutons, jauges, anneau), dans les deux thèmes. Toutes les paires de la palette retenue passent, vérifiées par calcul sur le prototype. Une couleur de marque trop claire ne sert jamais de couleur de texte.

**Thème.** Clair et sombre, **qui suit le système par défaut**, modifiable par l'Utilisateur (Système / Clair / Sombre).

**Logo et favicon.** On garde le dessin (éprouvette en diagonale, tracé blanc sur carré arrondi) et on le recolore en **dégradé teal `#115e59` → `#0d9488`** (piste prototypée : le blanc reste lisible dessus). La mise à jour de `BattleCRM_logo.svg` se fera à l'implémentation.

**Gamification et célébration.** On en reste aux bornes du ticket « Détachement des réponses négatives dans l'UX ». Rendu retenu : une quarantaine de confettis fins aux couleurs de la palette (teal, vert, gris), ~1,5 s, qui partent de l'endroit où l'Action a été enregistrée, avec un bref halo sur la carte d'Activité et le toast « Bravo, objectif du jour atteint ! 3 / 3 ». L'animation est coupée quand le système demande de réduire les animations ; le toast reste.

**Exigences pour la stack :**
- persister la préférence de thème (Système / Clair / Sombre) par Utilisateur, et suivre le thème du système en direct ;
- respecter la préférence système « réduire les animations » ;
- garantir le contraste AA dans les deux thèmes : les couleurs sont des jetons, jamais codées en dur.

**Précision (ticket [Réglages](14-reglages.md))** : le thème est conservé **par appareil**, pas par Utilisateur.
