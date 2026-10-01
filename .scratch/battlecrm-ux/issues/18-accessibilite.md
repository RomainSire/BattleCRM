# Accessibilité

Type: grilling
Status: resolved
Blocked by: 17

## Question

Quel niveau d'accessibilité vise-t-on au-delà du contraste, et qu'est-ce que ça impose aux écrans déjà tranchés ?

À trancher :
- La navigation clavier complète (ordre de tabulation, focus visible, panneaux et fenêtres, alternative clavier au glisser-déposer du Funnel).
- Les lecteurs d'écran, dont un équivalent textuel des graphes d'Activité, du Funnel et des jauges de Battle.
- Le niveau visé pour le reste (WCAG 2.2 AA en entier, ou une liste de critères).

Déjà tranché : contraste WCAG 2.2 AA non négociable dans les deux thèmes, et la préférence « réduire les animations » respectée (ticket « Direction visuelle »).
Le clavier global est tranché (palette `Ctrl K` ou `/`, `N`, `G` + lettre, `?`, `Échap`, raccourcis de la fiche ; ticket « Navigation globale (bureau) ») : reste à vérifier qu'il couvre tout sans souris.

## Answer

Tranché avec Romain le 2026-10-01.

**Niveau : WCAG 2.2 AA en entier**, sans dérogation implicite. Tout écart futur est écrit dans la spec avec son motif. Aucun écart n'est retenu à ce jour.

**Clavier**
- **Raccourcis à une touche (2.1.4)** : un interrupteur **« Raccourcis à une touche »** dans Réglages › Préférences, activé par défaut, coupe `N`, `/`, `?`, `G` + lettre et `V`. `Ctrl K` et `Échap` restent toujours actifs. Les raccourcis de la fiche (`F`, `U`, `I`, `P`) n'agissent que sur la fiche qui a le focus, en page comme en panneau. Pas de remappage.
- **Alternative au glisser-déposer du Funnel (2.5.7)** : pas de glisser au clavier. Sur une carte qui a le focus, **« Changer d'Étape… »** (`E`, également dans la palette et le menu de la carte) fait choisir l'Étape d'arrivée, puis ouvre **la même fenêtre** que le dépôt (règlement de l'Essai, puis enchaînement sur le geste central). Les flèches circulent entre les cartes, dans une colonne et d'une colonne à l'autre.
- **Focus dans les panneaux et les fenêtres** :
  - les panneaux de geste (Utiliser un Positionnement, A répondu…, Relancer…) et les fenêtres (conséquences, clôture de Battle, ajout rapide, ouverture de Battle) sont **modaux** : le focus y entre et y reste piégé ; `Échap` ferme, et le focus revient sur l'élément déclencheur ;
  - le **panneau de fiche Contact est non modal** : le focus y entre à l'ouverture ; `Échap` ferme et rend le focus à la carte ; passer sur une autre carte remplace son contenu.
- **Focus visible (2.4.7, 2.4.11, 2.4.13)** : anneau **teal** de 2 px avec décalage, au clavier seulement, contraste 3:1 dans les deux thèmes. Il n'est jamais masqué par la barre d'onglets ou le bouton collé en bas sur mobile. Un lien « Aller au contenu » en tête de page, et des régions repères (menu, contenu principal, panneau).

**Lecteurs d'écran et équivalents textuels**
- Règle générale (1.4.1) : **aucune information portée par la couleur, l'intensité ou un motif seuls.**
- **Jauge de Battle** : la phrase en langage naturel en est l'équivalent, et la jauge est décorative.
- **Graphe d'Activité** : un bouton **« Voir en tableau »** (par semaine ou par mois), une phrase de synthèse (« 214 actions sur 12 mois, Objectif atteint 61 jours »), et chaque case lisible au focus (date, total, Objectif du jour).
- **Funnel des Indicateurs** : un vrai tableau (passages par Étape, Taux de passage) dont les barres ne sont qu'un décor.
- **Historique des Champions** : « prouvé » ou « désigné » écrit en toutes lettres, en plus du fond plein ou hachuré.
- **Pastilles du menu** : le compteur ambre porte un libellé (« 3 à traiter »), et le point teal porte « Battle concluante ».
- **Annonces (4.1.3)** : le bandeau « Annuler » et la célébration « Bravo » sont annoncés dans une région live polie. Les confettis sont décoratifs.
- **Durée (2.2.1)** : le bandeau « Annuler » reste affiché **au moins 10 s** et se met en pause au survol ou au focus. **`Ctrl Z`** déclenche Annuler tant qu'il est affiché, mais jamais dans un champ de saisie, où il garde son sens natif.

**Mise en page**
- **Reflow à 400 % (1.4.10)** : en largeur étroite, **tous les écrans restent atteignables et utilisables**. Positionnements, ouverture de Battle et édition du Funnel existent en version empilée sous Plus, sans être optimisés pour le téléphone ni mis en avant. Le ticket « Parcours mobile » est amendé en ce sens. Le kanban et les tableaux larges défilent horizontalement (exception pour le contenu en deux dimensions).
- **Taille des cibles (2.5.8)** : 24 × 24 px minimum sur bureau ; 44 px sur mobile pour les actions rapides (onglets, bouton +, bouton collé en bas, raccourcis des cartes).

**Authentification (3.3.8)**, en complément du ticket « Parcours d'authentification » : le collage et les gestionnaires de mots de passe sont autorisés sur tous les champs (mot de passe, code à 6 chiffres, codes de secours), il n'y a aucun test cognitif ni CAPTCHA à énigme (la limitation des tentatives suffit), et un bouton « Afficher le mot de passe » est proposé.

**Pour la stack** :
- la préférence « Raccourcis à une touche » par Utilisateur ;
- les régions live pour les annonces ;
- la gestion du focus (piège dans les éléments modaux, retour au déclencheur) ;
- une mise en page qui dépend de la largeur et non du type d'appareil ;
- l'attribut de langue de la page qui suit la langue de l'Utilisateur ;
- une vérification de chaque écran : sans souris, au lecteur d'écran, à 400 % de zoom, dans les deux thèmes, et par un contrôle automatique.

**Précision ([spec](../spec.md), arbitrage du 2026-10-01)** : la phrase de synthèse du graphe d'Activité ne compte pas les jours où l'Objectif a été atteint (« 214 actions sur 12 mois ») : l'équivalent textuel ne dit rien de plus que le graphe, qui ne marque pas l'Objectif. L'Objectif du jour reste lisible au focus de chaque case.
