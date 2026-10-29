# Spec UX : BattleCRM

Status: ready-for-agent
Source: [carte UX](map.md), 19 tickets résolus (`issues/01` à `issues/19`), consolidés le 2026-10-01 ; amendée le 2026-10-06 par la carte [Cercle d'alliés](../battlecrm-cercle/map.md) (États Vivier, En prospection, Allié, Archivé ; [ADR 0007](../../docs/adr/0007-etats-vivier-en-prospection-allie-archive.md)).

Cette spec est la destination de la carte UX. Elle rassemble ce qui a été tranché ticket par ticket : inventaire des écrans, navigation, gestes, comportements, direction visuelle et **exigences pour la stack**. Elle doit alimenter le wayfinder stack, puis le découpage en tickets d'implémentation.

**Ce qui fait foi.** Le modèle et son vocabulaire viennent de [`CONTEXT.md`](../../CONTEXT.md) et de [`docs/adr/`](../../docs/adr/). Le détail de chaque décision (variantes écartées, raisons) reste dans son ticket ; cette spec en garde la décision. Quand deux tickets se contredisent, l'arbitrage est noté au §11. Les écarts que l'UX avait introduits dans le modèle ont été tranchés et consignés le 2026-10-01 (§12). Les passages qui viennent de la carte Cercle d'alliés citent ses tickets avec le préfixe « C » ([C01](../battlecrm-cercle/issues/01-amender-glossaire-adr.md) glossaire et ADR, [C02](../battlecrm-cercle/issues/02-objectif-d-entrees-hebdomadaire.md) Objectif d'entrées, [C03](../battlecrm-cercle/issues/03-page-cercle-et-aujourdhui.md) page Cercle et Aujourd'hui, [C04](../battlecrm-cercle/issues/04-gestes-changement-d-etat.md) gestes d'État).

---

## 1. Principes transverses

- **Vocabulaire.** Les termes du glossaire s'affichent tels quels à l'écran (Contact, Positionnement, Essai, Battle, Relance…). En anglais (US), on utilise la ligne `_EN_` de chaque terme ([ticket 06](issues/06-vocabulaire-anglais.md)). Interface bilingue FR/EN dès le départ.
- **Ton** ([05](issues/05-detachement-reponses-negatives.md)). Tutoiement en français, ton de pair, factuel. Aux moments sensibles, on dit ce que l'événement apporte (une donnée, une progression), sans consoler ni féliciter. Une phrase stable par situation.
- **Détachement des réponses négatives** ([05](issues/05-detachement-reponses-negatives.md)). Jamais de rouge ni d'icône d'alerte pour un « sans suite ». Les taux de succès n'apparaissent que pour comparer deux Positionnements dans le détail d'une Battle, jamais pour l'Utilisateur. Aucune détection de série. Ce qu'on met en avant : l'Activité, les Essais terminés, la progression des Battles.
- **Pas d'onboarding** : le Funnel est pré-rempli avec des Étapes types, et les états vides se suffisent à eux-mêmes.
- **Bureau d'abord, mobile pour l'usage rapide.** « Mobile » signifie **largeur étroite**, pas type d'appareil ([18](issues/18-accessibilite.md)).
- **Clavier d'abord** sur bureau : palette de commandes, ajout rapide, raccourcis (§3.3).
- **Une seule forme par geste.** Un geste s'ouvre dans le même panneau quel que soit son déclencheur. Sur mobile, ce panneau devient une feuille plein écran, avec le même contenu.
- **Récapitulatif des conséquences** avant toute validation d'un geste qui touche l'Essai, la Cadence, l'Activité, l'Étape ou l'État.
- **Allié repérable partout** : le nom d'un Allié porte une petite étoile ★, partout où il apparaît (listes, cartes, fiche, palette, Aujourd'hui, Organisation), avec le libellé accessible « Allié ». Jamais la couleur seule (relecture du 2026-10-06).
- **Annuler plutôt que confirmer** : après un enregistrement, une notification « Annuler » s'affiche au moins 10 s, se met en pause au survol ou au focus, et répond à `Ctrl Z` hors des champs de saisie. Les confirmations sont réservées aux effets qu'on ne peut pas annuler simplement (archivage d'une Étape, clôture d'une Battle, changement de type d'une Organisation, suppression d'un Contact).
- **Accessibilité : WCAG 2.2 AA en entier**, sans dérogation implicite ([18](issues/18-accessibilite.md)). Tout écart futur s'écrit ici avec son motif. Aucun à ce jour.

## 2. Direction visuelle

Source : [07](issues/07-direction-visuelle.md) ; prototype `prototype/07-direction-visuelle`.

- **Sobre et dense** : neutres gris-zinc, texte courant d'environ 13 px en police système, arrondis de 6 px (contrôles) et 8 px (cartes), cartes à filet fin sans ombre, chiffres tabulaires.
- **Palette** : une couleur par sens, chacune dans sa propre variable (valeurs de départ, contrôlées pour le contraste AA).

| Rôle | Clair | Sombre | Usage |
|---|---|---|---|
| Accent (teal) | `#0f766e` (bouton, texte blanc) | bouton `#2dd4bf` à texte sombre, texte `#5eead4` | action principale, contour des actions de carte, Challenger, Battle, anneau et graphe d'Activité, Champion prouvé dans l'Historique, focus |
| Succès (vert) | `#15803d` | `#4ade80` | Essai en Succès, « Objectif atteint », Objectif d'entrées atteint (semaine en cours) |
| Retard (ambre) | `#a84d06` | `#f59e0b` | Relances en retard, Alliés « à relancer », compteur de la navigation |
| Bientôt (ambre clair) | texte `#8a5a14`, jauge `#b07c1a` | texte `#fcd34d`, jauge `#d4a24c` | Alliés « bientôt » (jauge du Rythme, Jours sans contact) |
| Neutre (gris) | point `#a1a1aa`, texte `#63636b` | point `#71717a`, texte `#a1a1aa` | sans suite, en cours, Vivier, archivé, délai dépassé, Champion dans une jauge, Allié sans signal |
| Erreur (rouge) | `#b91c1c` | `#f87171` | message d'erreur (saisie, refus, panne), contour du champ en défaut ; jamais un résultat |

- **« Bientôt » contrôlé le 2026-10-08** sur les fonds zinc (clair `#ffffff` / `#f4f4f5`, sombre `#18181b` / `#27272a`) : texte clair 5,4:1 à 5,9:1, jauge claire 3,3:1 à 3,7:1, texte sombre 10,3:1 à 12,3:1, jauge sombre 6,4:1 à 7,7:1. La jauge `#e2b062` du prototype C03 (1,8:1 à 2:1) ne passait pas le 3:1 des composants. Le palier et le nombre de jours, toujours écrits, distinguent « bientôt » de « à relancer » sans dépendre de l'écart entre les deux ambres.
- **Rouge réservé aux erreurs** (amendé le 2026-10-11, ticket d'implémentation 07) : rôle **Erreur**, clair `#b91c1c`, sombre `#f87171`, pour une erreur de saisie, un refus de l'API ou une panne, et rien d'autre. Tout message d'erreur de l'app est dans cette couleur, en gras ; hors d'un champ, il porte une icône ; le champ en défaut prend un contour de la même couleur, son message juste dessous (jamais la couleur seule). **Jamais de rouge pour un résultat** : sans suite, retard, délai dépassé, taux, Allié à relancer restent neutres ou ambre.
- **Un seul bouton plein par écran.** Les actions de ligne sont des boutons neutres, la première en gras. Une action qui sort de la routine (« Clôturer… ») porte un contour d'accent.
- **Contraste** : 4,5:1 pour le texte, 3:1 pour les formes et composants, dans les deux thèmes.
- **Thème** clair et sombre, qui suit le système par défaut, modifiable (Système / Clair / Sombre), **par appareil** (§11).
- **Logo** : même dessin, recoloré en dégradé teal `#115e59` → `#0d9488` (mise à jour de `BattleCRM_logo.svg` à l'implémentation).
- **Célébration de l'Objectif d'activité** : une fois par jour, au franchissement. Environ quarante confettis fins (teal, vert, gris) pendant ~1,5 s, qui partent de l'endroit où l'Action a été enregistrée, un bref halo sur la carte d'Activité, et le toast « Bravo, objectif du jour atteint ! 3 / 3 ». Pas de paliers. Les confettis sont coupés si le système demande de réduire les animations ; le toast reste. Désactivable (« Célébrer l'Objectif atteint »).

## 3. Navigation

### 3.1 Bureau

Source : [17](issues/17-navigation-globale-bureau.md) ; prototype `prototype/17-navigation-bureau` (`?variant=A`).

Une **barre latérale à gauche**, avec les libellés visibles :
- en haut : la marque, « Rechercher… » (ouvre la palette, `Ctrl K` affiché), puis **« + Ajouter »** (`N`) ;
- **Prospection** : Aujourd'hui, Cercle, Contacts, Funnel ([C03](../battlecrm-cercle/issues/03-page-cercle-et-aujourdhui.md)) ;
- **Expérimentation** : Battles, Positionnements, Indicateurs ;
- en bas : Réglages, « Raccourcis » (`?`), l'adresse du compte et « Se déconnecter ».

**Pastilles** : un compteur ambre sur Aujourd'hui, qui compte les Relances dues ou en retard, les Essais délai dépassé et les Alliés à relancer (C03). Il n'affiche qu'un nombre ; l'infobulle et le libellé accessible disent « 3 à traiter, 2 Alliés à relancer » (« à traiter » reste réservé aux Contacts En prospection, [C04](../battlecrm-cercle/issues/04-gestes-changement-d-etat.md)). Un point teal sur Battles quand une Battle est concluante, libellé « Battle concluante ». L'entrée Cercle n'a pas de pastille. Aucune autre pastille.

**Pages sans entrée de menu** : la fiche Contact en page et la page Organisation allument l'entrée Contacts, avec un fil d'Ariane « Contacts › … ».

### 3.2 Mobile

Source : [08](issues/08-parcours-mobile.md) ; prototype `prototype/08-parcours-mobile` (`?variant=A`).

- **Barre d'onglets en bas** : Aujourd'hui (écran d'arrivée), Contacts, Funnel, Plus. Les trois premiers correspondent au groupe Prospection du bureau.
- **Bouton + flottant** : Ajouter un Contact, Noter une Interaction…
- **Loupe** dans l'en-tête : c'est la palette du mobile (Contacts et actions).
- **Plus** : Cercle (en tête, C03), Battles, Indicateurs, Réglages simples (langue, thème, célébration, Compte), puis, sous « Sur ordinateur », Positionnements, l'ouverture d'une Battle et l'édition du Funnel. Ces écrans restent atteignables et utilisables en version empilée (reflow WCAG), sans être pensés pour le téléphone ni mis en avant.

### 3.3 Palette de commandes et raccourcis

**Palette** (`Ctrl K` ou `/`), une fenêtre centrée ([17](issues/17-navigation-globale-bureau.md)) :
- **sans saisie** : les Contacts à traiter (Relances dues ou en retard, Essais délai dépassé) et les Alliés à relancer, mêlés par ancienneté du retard (C04) ;
- **pendant la frappe**, des groupes : Contacts (nom, Organisation, Étape), Organisations, Actions, Créer (Ajouter un Contact, Noter une Interaction…, Créer un Positionnement, Ouvrir une Battle…), Aller à, Préférences et autres (Historique des Champions, kanban/table, thème, langue, raccourcis, se déconnecter) ;
- **Contact d'abord** : `→` ou `Tab` sur un Contact affiche ses actions, filtrées par son État (Ouvrir la fiche, Relancer…, A répondu…, Utiliser un Positionnement, Noter une Interaction, Prendre des nouvelles… pour un Allié seulement, Planifier une Relance, Changer d'Étape…, Faire entrer…, Remettre au Vivier…, Ajouter au Cercle…, Archiver…, Changer d'État…, Ouvrir l'Organisation ; jamais le verbe de l'État actuel). `⌫` dans le champ vide revient en arrière ;
- **Verbe d'abord** : « relancer jul » propose « Relancer · Julie Martin ». Un mot du verbe suffit : « nouvelles jul », « cercle jul », « entrer jul », « archiver jul », « vivier jul » (C04) ;
- `Entrée` sur un Contact ouvre sa fiche en page. Sans résultat, la palette propose d'ajouter ce nom comme Contact.

**Raccourcis** (rappelés dans l'aide `?` et dans les infobulles) :

| Portée | Touches |
|---|---|
| Partout | `Ctrl K` ou `/` palette ; `N` ajouter un Contact ; `?` aide ; `Échap` ferme |
| Aller à | `G` puis `A` Aujourd'hui, `E` Cercle, `C` Contacts, `F` Funnel, `B` Battles, `P` Positionnements, `I` Indicateurs, `R` Réglages (repère « G … » affiché) |
| Fiche Contact qui a le focus (page ou panneau) | `F` Relancer…, `U` Utiliser un Positionnement, `I` Noter une Interaction, `P` Planifier / Modifier la Relance, `S` Changer d'État… ; sur un Allié, `F` ouvre l'action pleine du moment (Relancer… ou Prendre des nouvelles…) et `I` Prendre des nouvelles… |
| Funnel | `V` kanban/table ; sur une carte qui a le focus : `E` Changer d'Étape…, `S` Changer d'État…, flèches pour circuler entre les cartes |
| Panneaux de geste | `Entrée` valide ; `1` `2` `3` règlent l'Essai dans « A répondu… » |
| Ajout rapide | `Entrée` ajoute ; `Ctrl Entrée` ajoute En prospection (quel que soit l'État choisi) puis enchaîne sur « Utiliser un Positionnement » |

Pas de touche par verbe d'État : `S` ouvre « Changer d'État… », qui commence par le choix de la cible (C04).

- Aucun raccourci à une lettre ne s'active dans un champ de saisie.
- L'interrupteur **« Raccourcis à une touche »** (Réglages › Préférences, activé par défaut) coupe `N`, `/`, `?`, `G` + lettre et `V`. `Ctrl K` et `Échap` restent toujours actifs. Pas de remappage.

## 4. Inventaire des écrans

| Écran | Accès | Bureau | Mobile | Ticket · prototype |
|---|---|---|---|---|
| Aujourd'hui | menu, écran d'arrivée | tableau de bord par blocs | « une chose à la fois » | [01](issues/01-ecran-aujourdhui.md) · `prototype/01-aujourdhui` (B bureau, C mobile) ; [C03](../battlecrm-cercle/issues/03-page-cercle-et-aujourdhui.md) · `prototype/03-page-cercle` (C) |
| Cercle (§5.11) | menu, Plus | trois paliers | cartes, avec la jauge | [C03](../battlecrm-cercle/issues/03-page-cercle-et-aujourdhui.md) · `prototype/03-page-cercle` (B) |
| Contacts (§5.10) | menu, onglet | liste et fiche en panneau ancré | liste, fiche en page | [19](issues/19-ecran-contacts-modifier-contact.md) · `prototype/19-ecran-contacts` (B) |
| Fiche Contact | page (« Ouvrir en page », palette, lien) ; panneau (Funnel, Aujourd'hui, ancré dans Contacts) | page à deux colonnes ou panneau | page empilée | [12](issues/12-fiche-contact.md) · `prototype/12-fiche-contact` (A et B) |
| Organisation | clic sur le nom, palette | page légère | lecture seule | [15](issues/15-organisations.md) |
| Funnel | menu, onglet | kanban en couloirs (défaut) et table | liste groupée par Étape | [03](issues/03-vue-funnel-kanban-table.md) · `prototype/03-vue-funnel` (C) |
| Battles (onglets Battles, Historique des Champions) | menu, Plus | vue d'ensemble et panneau | consultation et clôture | [04](issues/04-lisibilite-battle.md) · `prototype/04-battle` (B) |
| Positionnements | menu, Plus › Sur ordinateur | atelier à trois colonnes | empilé, non optimisé | [13](issues/13-gestion-positionnements.md) · `prototype/13-gestion-positionnements` (C) |
| Indicateurs | menu, Plus | écran dédié | consultable, sans parcours propre | [09](issues/09-ecrans-indicateurs-activite.md) · `prototype/09-indicateurs` (B) |
| Réglages | menu, Plus | quatre sections | langue, thème, célébration, Compte | [14](issues/14-reglages.md) |
| Authentification | hors session | écrans dédiés | identiques | [16](issues/16-parcours-authentification.md) |

## 5. Écrans

### 5.1 Aujourd'hui

Amendé par [C03](../battlecrm-cercle/issues/03-page-cercle-et-aujourdhui.md) (variante C) et [C02](../battlecrm-cercle/issues/02-objectif-d-entrees-hebdomadaire.md).

- **Bandeau Entrées**, en tête : « Entrées cette semaine 2/5 » (semaine du lundi ; couleur de succès dès que l'Objectif d'entrées est atteint, sans célébration ; « 6/5 » si dépassé ; désactivé : « 3 cette semaine », sans dénominateur ni couleur). Puis 3 ou 4 Contacts du Vivier tirés au hasard (nom, Organisation, dernière Étape atteinte ou « jamais entré ») avec **Faire entrer…** (fenêtre §6.11). Un Contact entré sort du bandeau et **un autre Contact du Vivier est tiré pour le remplacer**, tant que le Vivier en compte : il y a toujours plusieurs propositions (relecture du 2026-10-06). Les propositions restent une fois l'objectif atteint.
- **Bureau** : sous le bandeau, colonne principale avec **les Relances (en retard et du jour) et les Alliés à relancer mêlés dans une même liste, triée par ancienneté du retard** (pour un Allié : jours au-delà du Rythme des Alliés), puis les Essais délai dépassé et les Contacts sans prochaine action. La ligne d'un Allié est marquée « Allié » et dit « Rythme dépassé (n j) · n j sans contact », avec **Prendre des nouvelles…** (§6.14). Colonne latérale : l'Activité du jour face à l'Objectif (jauge et graphe des dernières semaines, lien « Indicateurs → » ; le graphe se lit comme celui de GitHub, une colonne par semaine, la semaine en cours à droite, du lundi en haut au dimanche en bas, et montre autant de semaines que la largeur en tient, au moins 4 : amendé le 2026-10-24, ticket d'implémentation 39), « Cercle 7/10 » avec un lien vers la page Cercle, les Battles concluantes et « À venir » (Relances de demain).
- **Mobile** : une carte par élément, dans l'ordre de priorité, avec la progression de la journée et un écran « journée bouclée » à la fin (la célébration s'y fond). La carte Entrées vient en premier : un seul Contact du Vivier à la fois, avec **Faire entrer…** et **Un autre** (qui en propose un autre). Pas de « Plus tard » sur la carte d'un Allié.
- **Ordre de priorité** : Entrées, puis Relances et Alliés à relancer mêlés par ancienneté du retard (la plus ancienne d'abord, Relances du jour comprises), Essais délai dépassé, Battles concluantes.
- **Contacts sans prochaine action** : Contacts En prospection sans Relance planifiée ni Essai en cours, dans une Étape qui a au moins un Positionnement (glossaire : Sans prochaine action). On en montre 3 ou 4, tirés au hasard une fois par jour : un Contact traité sort de la liste sans être remplacé. Action principale « Utiliser un Positionnement », secondaire « Planifier une Relance ».
- **Actions directes** :
  - Relance : **Relancer…** (panneau §6.3), Reporter (demain, +3 j, +7 j), Annuler, A répondu… ;
  - Essai délai dépassé : **Sans suite** (puis proposition de remettre au Vivier, §6.7), Relancer quand même (Relance hors Cadence, écart tracé sur l'Essai) ;
  - Allié à relancer : **Prendre des nouvelles…** (§6.14) ; un Allié dont la Relance planifiée est due apparaît comme une Relance, avec **Relancer…** ;
  - Contact du Vivier proposé : **Faire entrer…** (§6.11) ;
  - Battle concluante : **Clôturer…** (fenêtre §6.9), Plus tard (masquée jusqu'au lendemain, sur tous les appareils) ;
  - partout, un lien vers la fiche Contact, qui s'ouvre en panneau.
- **États vides** : premier jour (« Aucun Contact pour l'instant », les Étapes types, « Ajouter un Contact » `N`) ; rien de prévu (un message, les Relances de demain, les Contacts sans prochaine action) ; Objectif atteint (la jauge passe à « atteint ») ; Vivier vide (le bandeau Entrées garde son compteur, avec « Ajouter un Contact » `N` à la place des propositions).

### 5.2 Funnel

- **Kanban en couloirs** : les colonnes sont les Étapes non archivées. L'en-tête porte le nom, le But en sous-titre, le nombre de Contacts et la Battle ouverte (Champion vs Challenger, Essais sur l'Horizon) ; son menu propose « Renommer » et « Gérer les Étapes… » (vers Réglages). Les lignes sont calculées, on n'y dépose rien :
  1. **À traiter**, mise en avant : Relance en retard ou du jour, Essai délai dépassé, conséquence d'un déplacement restée à régler ;
  2. **En attente** : Relance planifiée à venir, Essai en cours dans les temps, ou Contact dans une Étape sans Positionnement ;
  3. **Sans prochaine action**.
- **Tri dans une case** : par urgence (Relance en retard la plus ancienne, Relance du jour, ce qui reste à régler, délai dépassé, sans prochaine action, puis date de Relance). Pas d'autre tri.
- **Carte** : nom, Organisation et Cible ; la prochaine action (Relance et rang, « en retard · n j » ou « aujourd'hui » ; Essai en cours, « délai dépassé ») ; les raccourcis d'action, identiques à ceux d'Aujourd'hui ; le menu `⋯` (Changer d'Étape…, Remettre au Vivier…, Ajouter au Cercle…, Archiver…, Changer d'État…, ouvrir la fiche).
- **Le Funnel ne montre que les Contacts En prospection** ([C04](../battlecrm-cercle/issues/04-gestes-changement-d-etat.md)). Le Vivier n'est pas une colonne ; le filtre d'État, la ligne « Masqués : … » et la ligne « Hors prospection active » sont supprimés.
- **Changer d'Étape** : par glisser-déposer, par `E` sur la carte, par `⋯` ou par la palette. Tous mènent à la **fenêtre de conséquences** (§6.6). Pendant le glisser apparaissent trois zones d'État, **Vivier**, **Cercle** et **Archivé** : chacune ouvre la fenêtre de changement d'État réglée sur sa cible (§6.11). `S` sur une carte ouvre « Changer d'État… ».
- **Vue table** (`V`) : Contact, Organisation, Cible, Étape (modifiable en ligne, avec la fenêtre de conséquences), Essai en cours, prochaine Relance, date d'entrée dans l'Étape. Triable, par urgence par défaut. **Le dernier choix kanban/table est retenu, par appareil.**
- **Filtres communs** : nom ou Organisation, Cible, Battle, Organisation, signal (Relance en retard, délai dépassé, sans prochaine action).
- **Pas d'indicateurs** dans le Funnel : ils sont sur l'écran Indicateurs.
- **Mobile** : liste groupée par Étape, sans glisser-déposer ni table ; on change d'Étape depuis la fiche.
- Le kanban défile horizontalement en largeur étroite (contenu en deux dimensions).

### 5.3 Fiche Contact

- **Panneau** (depuis le Funnel, Aujourd'hui et le Cercle, non modal ; ancré à droite de la liste dans l'écran Contacts, §5.10) : un bloc **Prochaine action** (selon l'État, voir plus bas) avec le bouton plein et `⋯`, puis « Noter une Interaction » (« Prendre des nouvelles… » sur un Allié), des onglets Fil / Détails et « Ouvrir en page ». Passer sur une autre carte remplace son contenu.
- **Page** (adresse propre) : en-tête avec le nom, l'Organisation et la Cible, le lien LinkedIn, les pastilles Étape (avec le But, pour un Contact En prospection) et État ; la pastille d'Étape ouvre la fenêtre de conséquences (§6.6), la pastille d'État ouvre « Changer d'État… » (§6.11) ; puis les actions. Deux colonnes : le **fil** à gauche ; à droite **Essai en cours** (Positionnement, Battle, rôle Champion ou Challenger, Critère de succès, durée, « A répondu… ») et **Coordonnées** (poste, Organisation, Cible, e-mail, téléphone, LinkedIn, note, Étape, État et motif, « Modifier » : édition sur place, §6.12).
- **Tête du fil** : la Relance planifiée, distincte comme élément futur (rang ou « hors Cadence », signal, note ; Relancer… / Modifier / Annuler), ou le rappel « sans prochaine action » avec « Planifier une Relance ». Puis les Interactions, de la plus récente à la plus ancienne ; les changements d'Étape et d'État sont discrets. *Point d'attention pour le développement : cet élément de tête était fragile dans le prototype.*
- **Bloc Prochaine action et bouton plein selon l'État** ([C04](../battlecrm-cercle/issues/04-gestes-changement-d-etat.md)) :
  - **En prospection** : Relance du jour ou en retard → Relancer… ; Essai délai dépassé → Sans suite… ; ni Relance ni Essai → Utiliser un Positionnement ; en attente → A répondu… ;
  - **Vivier** : « Au Vivier · dernière Étape : <Étape> » (ou « jamais entré »), bouton plein **Faire entrer…** ;
  - **Allié** : « Allié · n j sans contact » avec la jauge du Rythme (ou la Relance planifiée), bouton plein **Relancer…** si une Relance est due, sinon **Prendre des nouvelles…** ;
  - **Archivé** : fiche grisée, avec le motif et la phrase « Rien n'est définitif : tu peux le faire revenir. » Bouton plein **Faire entrer…**, et en secondaire Remettre au Vivier… et Ajouter au Cercle….

  Les autres actions sont en boutons secondaires (page) ou sous `⋯` (panneau) ; les verbes d'État y figurent tous, sauf celui de l'État actuel.
- **Mobile** : page empilée (Essai en cours, Coordonnées, fil), avec une barre collée en bas (bouton plein, « Noter » ou « Nouvelles » sur un Allié, `⋯`).
- **Sous `⋯`**, en dernier : « Supprimer le Contact… » (§6.13).

### 5.4 Organisation

- Page légère : nom, type, liste de ses Contacts (Étape, État, prochaine action). On y renomme, change le type, fusionne et supprime.
- **Changer le type** : fenêtre de conséquences (« 4 Contacts passent en Cible ESN. Les Essais déjà commencés gardent leur Cible. »), absente si l'Organisation n'a aucun Contact.
- **Fusionner avec…** : on choisit l'Organisation qui reste ; ses Contacts prennent son type, avec la même fenêtre.
- **Supprimer** : seulement sans Contact. Une Organisation sans Contact n'est jamais supprimée automatiquement.
- Mobile : lecture seule.

### 5.5 Battles et Historique des Champions

- **Onglet Battles** : une ligne par Étape du Funnel. Avec une Battle ouverte : « Champion vs Challenger », la phrase, une mini-jauge, « n+n terminés · n succès », l'état (« trop tôt », « en cours ») ou **Clôturer…** (concluante ou Horizon atteint). Sans Battle : « Pas de Battle. Champion : X » (ou « ni de Champion ») et **Ouvrir une Battle…**
- **Panneau d'une Étape**, quatre onglets :
  - **Suivi** : la phrase, le bandeau « Concluante » ou « Horizon atteint », la jauge, la progression (terminés vers 10 par Positionnement, commencés vers l'Horizon, succès vers 5), Critère de succès, Cible, seuil, Horizon, date d'ouverture ; « Clôturer quand même… » si la Battle n'est pas concluante ;
  - **Essais** : Contact, Positionnement, début, issue (modifiable en ligne tant que la Battle est ouverte, avec le rappel du Critère) ;
  - **Par Cible** : succès sur terminés par Cible et par Positionnement, « à titre indicatif » ;
  - **Historique** de l'Étape.
- **Phrase** selon l'état : « trop tôt » (qui mène, ce qui manque), « X a n % de chances de faire mieux que Y, il en faut 85 % », « concluante », « Horizon atteint : égalité », « données insuffisantes ». **Jauge** : P(Challenger meilleur), avec les zones de seuil aux deux extrémités ; grisée, hachurée et marquée « indicatif » tant que le minimum n'est pas atteint. La phrase est l'équivalent textuel de la jauge, qui est décorative.
- **Historique des Champions** : une lignée horizontale par Étape, du Champion initial à la Battle en cours. Chaque case donne le Champion, la date et l'Enseignement ; les flèches portent le Verdict. Prouvé : fond plein (teal, §11) ; désigné (Champion initial ou vainqueur contre la règle) : hachuré, bord en pointillés ; titre conservé : case neutre. « Prouvé » ou « désigné » est aussi écrit en toutes lettres. Une légende accompagne les lignées.
- Mobile : consultation et clôture ; l'ouverture d'une Battle n'est pas pensée pour le téléphone.

### 5.6 Positionnements

- **Atelier à trois colonnes** : les Étapes (nombre de Positionnements non archivés) ; les Positionnements de l'Étape **en lignées** (une copie modifiée sous son original, décalée), avec le libellé, le badge Champion ou Challenger, le canal, la Cadence abrégée, les pièces jointes, « 🔒 n Essais · figé » ou « jamais utilisé · modifiable », et le bouton plein « + Nouveau » ; **la fiche** sur place (contenu, pièces jointes, chaque Relance avec son délai et son message, Délai de réponse, utilisation, liens vers l'original et les copies).
- **Positionnement figé** : « 🔒 Figé : utilisé dans n Essais », la raison, puis **Créer une copie modifiée…** (bouton plein) et **Corriger le libellé** (fautes de frappe, s'applique partout).
- **Jamais utilisé** : Modifier, Dupliquer…, Supprimer (annulable).
- **Utilisé hors Battle** : reste modifiable (pas d'Essai) mais n'est plus supprimable. *Point d'attention pour le développement : figé et supprimable ne coïncident pas.*
- **Archiver** à la main (ni Champion ni dans une Battle ouverte), **Désarchiver**. Les archivés restent dans leur lignée derrière « Afficher les archivés (n) », avec leur motif (« battu par … le … », « archivé à la main »).

### 5.7 Indicateurs

- **Période** en tête : 30 jours, 3 mois, 12 mois, depuis le début.
- **Chiffres d'effort en tête** : Actions de prospection de la semaine (et la précédente), Actions sur la période (et moyenne par jour), Essais terminés, **Entrées dans le Funnel de la semaine face à l'Objectif d'entrées** (« 3/5 », couleur de succès une fois atteint ; « 3 cette semaine » si désactivé) et **Taille du Cercle** (« 7/10 », ou « 7 Alliés » sans Taille visée) ([C02](../battlecrm-cercle/issues/02-objectif-d-entrees-hebdomadaire.md), carte Cercle). Aucun taux en tête.
- **Funnel** : un vrai tableau (passages par Étape dans l'ordre actuel, Taux de passage en second plan) dont les barres ne sont qu'un décor ; Étapes archivées sur demande, en gris, sans Taux de passage ; **sorties par État et par Étape** (vers Allié, Vivier, Archivé, depuis l'Étape où le Contact a quitté En prospection) ; Entrées dans le Funnel par semaine avec la moyenne, comme l'Activité : ni ligne d'objectif ni couleur de succès sur l'historique, et au survol ou au focus « 6 entrées · objectif : 5 » (l'Objectif en vigueur cette semaine-là). Taux de passage inchangé.
- **Activité** : graphe journalier sur 12 mois (intensité seule, jour vide neutre, aucune marque d'Objectif, aucune série) ; au survol ou au focus d'un jour, « 2 Actions · objectif du jour : 3 » (l'Objectif en vigueur ce jour-là) ; totaux hebdomadaires en barres, sans ligne d'objectif, semaine en cours atténuée ; « Voir en tableau » et une phrase de synthèse (« 214 actions sur 12 mois », sans décompte des jours d'Objectif atteint).

### 5.8 Réglages

Un écran, une colonne d'ancres, quatre sections. **Enregistrement automatique** champ par champ, avec « Annuler », sauf la Cadence par défaut (bouton « Enregistrer »).

- **Funnel** (le seul endroit où il s'édite) : liste ordonnée (poignée et `Alt+↑/↓`), nom et But modifiables sur place, compteurs (Contacts En prospection, Positionnements, Battle ouverte), « + Ajouter une Étape » et insertion au survol.
  - **Archiver** est grisé, avec la raison et un lien, tant que l'Étape a des Contacts En prospection ou une Battle ouverte (un Contact d'un autre État garde une Étape archivée comme dernière Étape atteinte) ; pas de déplacement en masse. Sinon, une confirmation récapitule les effets.
  - **Supprimer** remplace Archiver pour une Étape qui n'a jamais servi, sans confirmation, avec « Annuler ».
  - **Restaurer** (sous « Étapes archivées (n) ») replace l'Étape juste après celle qui la précédait, si elle est encore dans le Funnel, sinon en fin.
  - Réordonner, sans confirmation, avec la phrase permanente « Réordonner ne déplace aucun Contact ; l'historique garde l'ordre d'alors. »
  - **Étapes types**, créées à l'inscription dans la langue choisie et jamais traduites ensuite. Le Vivier n'en fait plus partie : c'est un État (ADR 0007).

    | FR | But | EN | Aim |
    |---|---|---|---|
    | Approche | CV à envoyer | Outreach | get asked for a CV |
    | Qualif ESN | entretien ESN à obtenir | Agency screening | get the agency interview |
    | Qualif Client | entretien client à obtenir | Client screening | get the client interview |
    | Closing | contrat à signer | Closing | sign the contract |

- **Prospection** : Objectif d'activité (1 par défaut, désactivable, « S'applique à partir de demain ») ; « Célébrer l'Objectif atteint », grisé quand l'Objectif est désactivé ; Cadence par défaut (intervalles et Délai de réponse, sans messages ; la modifier ne touche aucun Positionnement) ; **Objectif d'entrées** (5 par semaine par défaut, désactivable, dépassable ; « S'applique à partir du lundi 12 oct. », la semaine en cours garde sa valeur, [C02](../battlecrm-cercle/issues/02-objectif-d-entrees-hebdomadaire.md)) ; **Rythme des Alliés** (28 jours par défaut ; « bientôt » couvre toujours ses 7 derniers jours) ; **Taille visée du Cercle** (10 par défaut, désactivable, sans conséquence).
- **Préférences** : langue et fuseau horaire (par Utilisateur ; le fuseau s'applique à partir du lendemain) ; thème (par appareil) ; « Raccourcis à une touche ». « Réduire les animations » suit le système, sans réglage dans l'app.
- **Compte** : voir §5.9.
- Pas d'export de données ni de suppression de compte en V1.

### 5.9 Authentification et Compte

Source : [16](issues/16-parcours-authentification.md), complété par [18](issues/18-accessibilite.md).

- **Méthode** : e-mail et mot de passe seulement.
- **Inscription** : e-mail et mot de passe (bouton « Afficher », pas de confirmation). Langue préremplie depuis le navigateur, avec un sélecteur discret sur tous les écrans d'authentification ; fuseau détecté sans être demandé. Fermée par configuration : le lien « Créer un compte » disparaît et la page affiche « Les inscriptions sont fermées pour le moment. »
- **Mot de passe** : 15 caractères minimum, au moins 64 acceptés, espaces permis, aucune règle de composition, pas de jauge, pas d'expiration. Les mots de passe connus pour avoir fuité sont refusés. Aide : « 15 caractères minimum. Une phrase fait très bien l'affaire. »
- **Vérification de l'e-mail, bloquante** : écran « Vérifie ta boîte mail » identique que l'adresse soit libre ou prise (dans ce cas, e-mail « Tu as déjà un compte ») ; lien de 24 h à usage unique, qui connecte l'appareil où on le clique ; « Renvoyer le lien » avec un délai. Le clic mène sur « Aujourd'hui » vide, sans toast.
- **Connexion** : un seul message d'erreur ; ralentissement puis blocage temporaire (« Trop de tentatives. Réessaie dans 15 minutes, ou réinitialise ton mot de passe. ») ; pas de CAPTCHA ; collage et gestionnaires de mots de passe autorisés partout. Session longue et glissante (~90 jours d'inactivité), sans « Rester connecté ». Un lien profond ramène à la page demandée après la connexion.
- **Mot de passe oublié** : message toujours neutre ; lien de 1 h ; code du second facteur exigé s'il est actif ; à la fin, les autres appareils sont déconnectés et un e-mail part.
- **Double authentification** facultative (TOTP) : activation avec le mot de passe, QR code et clé copiable, code de confirmation ; 10 codes de secours affichés une fois (Copier, Télécharger, case « J'ai mis mes codes en lieu sûr ») ; mention quand il en reste 3 ou moins ; récupération par e-mail après un **délai de 7 jours annulable**.
- **Section Compte** : toute action sensible redemande le mot de passe. E-mail (changé au clic sur un lien envoyé à la nouvelle adresse, avertissement à l'ancienne), mot de passe (déconnecte les autres appareils), double authentification, **appareils connectés** (navigateur et système, dernière activité, Déconnecter, Déconnecter tous les autres), Se déconnecter (cet appareil, sans confirmation).
- **E-mails de sécurité**, dans la langue de l'Utilisateur, avec « Ce n'était pas moi » : changement de mot de passe, changement d'e-mail, activation ou désactivation de la double authentification, nouvel appareil.
- **Données sur l'appareil** effacées à la déconnexion et à la reconnexion d'un appareil déconnecté à distance.

### 5.10 Contacts

Source : [19](issues/19-ecran-contacts-modifier-contact.md) ; prototype `prototype/19-ecran-contacts` (`?variant=B`).

Écran distinct de la vue table du Funnel : on y cherche **une personne**, puis on agit sur elle.
- **Liste** à gauche : recherche en tête (nom, Organisation, poste, e-mail), puces d'État **Tous** (par défaut, **sans les Archivés**, avec une ligne « n archivés · Afficher »), Vivier, En prospection, Alliés, Archivés ([C04](../battlecrm-cercle/issues/04-gestes-changement-d-etat.md)). Tri unique : la dernière Interaction d'abord.
- **Ligne** : initiale, nom, date de la dernière Interaction, et selon l'État (« Sans Organisation » à défaut d'Organisation) :
  - En prospection : « Organisation · Étape » et le signal de prochaine action ;
  - Vivier : « Organisation · Vivier » ;
  - Allié : « Organisation · Allié » avec les Jours sans contact, en couleur seulement à partir de « bientôt » ;
  - Archivé : grisé, avec le motif.
- **À droite**, le **panneau de la fiche** (§5.3), ancré au lieu de flotter. Changer de ligne remplace son contenu ; « Ouvrir en page » mène à la page.
- **Mobile** : même liste ; toucher une ligne ouvre la fiche en page.
- **États vides** : « Aucun Contact pour l'instant », une phrase (seul le nom est obligatoire), « Ajouter un Contact » `N` ; recherche sans résultat : « Aucun Contact ne correspond ».

### 5.11 Cercle

Source : [C03](../battlecrm-cercle/issues/03-page-cercle-et-aujourdhui.md) ; prototype `prototype/03-page-cercle` (`?variant=B&ecran=cercle`).

- **En tête** : le compteur « 7/10 » en grand, une rangée de 10 pastilles (Taille visée du Cercle) et « Ajouter au Cercle… ». Sans Taille visée, les pastilles disparaissent et le compteur devient « 7 Alliés ».
- **Trois paliers**, chacun avec son effectif : **À relancer**, **Bientôt**, **À jour**, triés par Jours sans contact dans chaque palier. Le Cercle est ouvert à toutes les Cibles.
- **Par Allié** : nom, Organisation, Cible, dernière Interaction, la **jauge du Rythme** (remplie sur la durée du Rythme, un trait marque le début de « bientôt », couleur neutre, ambre clair ou ambre), le nombre de Jours sans contact, et **Prendre des nouvelles…** (§6.14), en gras pour les Alliés à relancer. Un clic sur le nom ouvre la fiche en panneau.
- **Relance planifiée** : un Allié qui a une Relance à venir est rangé dans À jour et l'affiche (« ⏰ Relance mer. 14 oct. ») : elle prime sur le Rythme. Due ou en retard, elle le range dans À relancer, avec **Relancer…**.
- **Jamais la couleur seule** : le palier donne le signal, et le nombre de jours est écrit. Jamais de rouge.
- **Ajouter au Cercle…** depuis la page : on choisit d'abord un Contact dans une liste filtrée à la frappe, sans les Alliés ; sans résultat, on propose l'ajout rapide en Allié. Puis la fenêtre §6.11.
- **État vide** : « 0/10 », « Ton Cercle est vide. Ajoute les ingénieurs d'affaires avec qui tu veux garder le contact, même pendant une mission. », « Ajouter au Cercle… », et le rappel qu'on peut le faire depuis la fiche.
- **Mobile** (sous Plus) : même liste en cartes, avec la jauge.

## 6. Gestes

Tous les panneaux de geste et toutes les fenêtres sont **modaux** (focus piégé, `Échap` ferme, focus rendu au déclencheur). Sur mobile, ils deviennent une feuille plein écran : étapes empilées, bouton de validation collé en bas, ✕ en haut, état conservé quand on passe dans une autre app puis qu'on revient.

### 6.1 Utiliser un Positionnement (geste central)

Source : [02](issues/02-geste-utiliser-positionnement.md) ; prototype `prototype/02-utiliser-positionnement` (`?variant=A2`).

Panneau « Envoyer à <Contact> », avec une ligne discrète pour l'Étape et la Battle :
1. **Quoi envoyer** : le Positionnement tiré au sort, avec le badge « tiré au sort » et une phrase qui explique pourquoi.
2. **Envoie-le** : le canal, le texte prêt à copier (`{prénom}` remplacé), les pièces jointes à télécharger.
3. **Confirme** : la date d'envoi (aujourd'hui, hier, autre), puis le récapitulatif (Essai commencé ou « sans Essai », Relance 1 à sa date avec « déjà en retard » si besoin et un lien « modifier », +1 à l'Activité du jour de l'Interaction).

« C'est envoyé » (`Entrée`) ou « Plus tard ». Puis une notification avec « Annuler » (« Envoyé à Claire : « CV B », Essai commencé. Relance 1 le 1ᵉʳ oct. »).

- **Dérogation** : « J'ai utilisé <l'autre> à la place » ouvre un motif facultatif ; le badge devient « ton choix » ; la dérogation est tracée sur l'Essai. Jamais de refus ni de re-tirage.
- **Tirage réservé** (ADR 0002) : équilibré à la volée parmi les Contacts de la même Cible ; une fois révélé, il est attaché au Contact ; « Plus tard » le garde, et rouvrir le geste montre le même Positionnement. Il tombe si la Battle est close ou si le Contact quitte l'Étape ou En prospection.
- **Garde-fous dans le panneau** : Contact du Vivier ou Archivé (« Faire entrer et continuer » par défaut, ou « Enregistrer sans Essai ») ; Allié (aucun garde-fou d'État : le geste est enregistré sans Essai, c'est une Action de prospection qui remet les Jours sans contact à 0, [C04](../battlecrm-cercle/issues/04-gestes-changement-d-etat.md)) ; Essai en cours ailleurs (on le règle d'abord, avec le rappel du Critère) ; déjà un Essai dans cette Battle (pas de tirage, choix libre, sans Essai) ; Contact déjà exposé (une ligne d'information, sans effet sur le tirage) ; Étape sans Battle ouverte, Contact hors de la Cible d'une Battle restreinte, ou Horizon atteint des deux côtés (Champion proposé, choix libre, sans Essai, avec une ligne qui dit pourquoi) ; Étape sans Positionnement (geste bloqué : « Créer un Positionnement pour cette Étape » ou « Noter une Interaction libre »).
- **Déclencheurs** : fiche (`U`), palette, Aujourd'hui, carte du Funnel, enchaînement après un changement d'Étape, une réponse ou « Faire entrer… », `Ctrl Entrée` de l'ajout rapide.

### 6.2 A répondu… (enregistrer une réponse)

Source : [10](issues/10-enregistrer-reponse-contact.md) ; prototype `prototype/10-enregistrer-reponse` (`?variant=A`).

Panneau « <Contact> a répondu » :
1. **Sa réponse** : date, canal (prérempli avec celui du dernier Positionnement utilisé), note facultative. Aucune nature positive ou négative.
2. **L'Essai** (s'il y en a un en cours) : Positionnement, Battle, Critère de succès, puis Succès, Sans suite ou Laisser en cours (`1` `2` `3`), **sans présélection**. Après Sans suite, la proposition de remettre au Vivier (§6.7 : Remettre au Vivier présélectionné, Garder En prospection, Archiver).
3. **Et ensuite** : « Annuler la Relance n planifiée » (cochée) ou « Planifier une Relance… » ; l'Étape (« Avancer à <suivante> si Succès », « Rester sinon », ou une autre ; après un Succès à la **dernière Étape** : **« Ajouter au Cercle »** présélectionné, ou « Rester En prospection à <Étape> ») ; « Enchaîner : utiliser un Positionnement maintenant » (cochée) si l'Étape d'arrivée a une Battle ouverte ; « État… » replié sans Essai en cours ; le récapitulatif.

**Réponse spontanée** (sans Essai en cours, [C04](../battlecrm-cercle/issues/04-gestes-changement-d-etat.md)) :
- Contact du Vivier ou Archivé : « Laisser au Vivier » ou « Laisser archivé » (présélectionné), « Faire entrer » (avec l'Étape et l'enchaînement, comme §6.11) ou « Ajouter au Cercle » ;
- Allié : aucun choix d'État. Les Jours sans contact repartent de la réponse, et le lien « Planifier une Relance… » est proposé.

« Enregistrer la réponse » (`Entrée`, inactif tant que l'Essai n'est pas réglé). L'Interaction entrante **arrête la Cadence** ; si l'Essai reste en cours, le Délai de réponse court depuis elle.

### 6.3 Relancer…

Source : [11](issues/11-relance-faite-aide-memoire.md).

Un seul libellé partout (EN *Follow up…*). Il remplace « Faite » et « J'ai relancé ». Panneau « Relancer <Contact> » :
1. **Envoie-le** : ce qui a été envoyé et quand, le canal, le message du rang à copier, les pièces jointes. Sans message (Relance hors Cadence), la note de la Relance et la dernière Interaction sortante.
2. **Confirme** : date et note modifiable ; récapitulatif (+1 à l'Activité, Relance suivante ou « puis le Délai de réponse »).

`F` ouvre, `Entrée` valide, puis « Annuler ». Pas de « Faite » en un clic. Les retouches du texte copié ne sont ni proposées ni tracées.

### 6.4 Noter une Interaction (sortante)

Source : [12](issues/12-fiche-contact.md). Panneau court : type (Appel, Rencontre, Message hors Positionnement, Autre), date, note, récapitulatif. Des liens renvoient vers « A répondu… » (tout l'entrant passe par là) et « Utiliser un Positionnement ». Conséquences affichées : hors Activité, l'Essai en cours reste en cours (son Délai de réponse repart de cette Interaction), et **la Relance planifiée par la Cadence est décalée** (chaque intervalle se compte depuis la dernière Interaction sortante faite).

Sur un **Allié**, ce geste est remplacé par « Prendre des nouvelles… » (§6.14), à la même place et avec la même touche `I` : toute Interaction sortante libre auprès d'un Allié est une Prise de nouvelles, donc compte dans l'Activité. Pour un Contact du Vivier ou Archivé, rien ne change (hors Activité).

### 6.5 Planifier / Modifier la Relance

Date (demain, +3 j, +7 j, +14 j, ou une date), note facultative, récapitulatif. Au plus une Relance planifiée par Contact : quand elle existe, le geste devient « Modifier la Relance » (elle garde son rang et son message ; changer sa date pendant un Essai est un écart tracé). Planifiée à la main sans Relance existante, elle est hors Cadence, sans message. Seuls un Contact En prospection et un Allié ont une Relance : le geste n'est pas proposé au Vivier ni pour un Archivé. Sur un Allié, elle est facultative et prime sur le Rythme des Alliés.

### 6.6 Fenêtre de conséquences (changer d'Étape)

Source : [03](issues/03-vue-funnel-kanban-table.md). Ouverte par le dépôt, `E`, `⋯`, la palette, la pastille d'Étape de la fiche, la table. La même fenêtre sert aux changements d'État, avec le contenu propre à chaque cible (§6.11).
- **Essai en cours** : rappel du Critère, puis Succès, Sans suite ou Laisser en cours ; choix proposé : Succès si le Contact avance, Laisser en cours s'il recule. Si l'Essai est réglé : « Annuler la Relance n planifiée » (cochée).
- **Battle ouverte à l'arrivée** : « Enchaîner : utiliser un Positionnement maintenant » (cochée), qui ouvre le geste central.
- **Pas de Battle à l'arrivée** : une ligne sur les Positionnements disponibles.
- **Recul** : signalé comme tel.
- **Dernière Étape** : un Succès à la dernière Étape propose « Ajouter au Cercle » (présélectionné) ou « Rester En prospection à <Étape> », comme dans « A répondu… ».
- Seul un Contact En prospection change d'Étape ; les autres y reviennent par « Faire entrer… » (§6.11).

### 6.7 Sans suite et proposition de remettre au Vivier

Source : [C04](../battlecrm-cercle/issues/04-gestes-changement-d-etat.md). Depuis un Essai délai dépassé (ou un Sans suite dans « A répondu… ») : l'Essai passe Sans suite, puis « Remettre <Contact> au Vivier ? Il reviendra dans les propositions d'entrée. », motif facultatif, **Remettre au Vivier** (présélectionné), Garder En prospection, Archiver. Notification : « Essai sans suite : un point de donnée de plus pour la Battle “<Étape>” (14/20 terminés). »

### 6.8 Ajout rapide d'un Contact

Seul le nom est obligatoire. Une commande segmentée **Vivier · En prospection · Allié** choisit l'État, sur **Vivier par défaut**, jamais retenue d'une fois sur l'autre ([C04](../battlecrm-cercle/issues/04-gestes-changement-d-etat.md)). Ajouté En prospection, le Contact fait une Entrée dans le Funnel. Champs visibles : nom, Organisation, URL LinkedIn, Étape (pour En prospection seulement) ; le lien « Plus de champs » déplie le poste, l'e-mail, le téléphone et la note (arbitrage du 2026-10-01). Organisation choisie dans une liste filtrée à la frappe (sans casse, accents ni espaces), ou créée avec son type. Doublons vérifiés **pendant la frappe**, jamais après `Entrée`, comme au §6.12 : même URL LinkedIn normalisée → création bloquée (« Ce Contact existe déjà : Jean Dupont · Capgemini », « Ouvrir sa fiche ») ; même nom (plus précis dans la même Organisation), et, s'ils sont remplis, même e-mail ou même téléphone → information discrète. Étape : la première non archivée par défaut, modifiable ; les Étapes qui précèdent celle choisie ne comptent pas comme sautées. `Entrée` ajoute ; `Ctrl Entrée` force En prospection et enchaîne sur le geste central.

### 6.9 Ouvrir et clôturer une Battle

- **Ouverture**, assistant en 3 étapes dans le panneau : (1) Qui affronte qui : le Champion (ou d'abord le Champion initial à désigner), le Challenger parmi les Positionnements de l'Étape, archivés compris (« revient comme Challenger »), lien « + Créer un Positionnement » ; (2) Critère de succès, repris de la Battle précédente de l'Étape, sinon du But ; (3) restriction de Cible, seuil (85 %), Horizon (25), rappel qu'ils sont figés et que le minimum ne se règle pas, récapitulatif en une phrase, **Ouvrir la Battle**.
- **Clôture**, fenêtre : le Verdict de la Règle de victoire présélectionné ; déclarer un autre vainqueur exige de cocher « Je désigne ce vainqueur quand même » après un avertissement ; abandonner rappelle que la Battle n'a rien appris ; conséquences (Champion, archivage, Essais en cours annulés « Battle clôturée » sans toucher aux Relances) ; Enseignement facultatif, mis en avant pour égalité et données insuffisantes. **Clôturer** ou **Plus tard**.
- **Microcopie** : on annonce le nouveau Champion d'abord (« X devient Champion de “<Étape>” », puis « Y est archivé, il peut revenir comme Challenger ») ; égalité : « Pas d'écart détectable entre X et Y : à ce volume, seul un écart important se voit. Les deux se valent probablement ; X garde son titre. » ; données insuffisantes : « Trop peu de succès pour départager X et Y. » « Battu » n'est jamais un titre à l'écran.

### 6.10 Créer un Positionnement ou une copie modifiée

Panneau : Étape (verrouillée selon la provenance), libellé, canal en puces (E-mail, LinkedIn, Téléphone, Courrier ; « un autre canal, c'est un autre Positionnement »), « Ce que tu envoies » (avec « insérer {prénom} »), pièces jointes, « Relances si pas de réponse » (une ligne par rang avec délai et message facultatif, Délai de réponse), prérempli avec la Cadence par défaut ou avec l'original. **Retours vers le parcours d'origine** : « Créer et revenir à la Battle » (l'assistant reprend avec ce Challenger) ; « Créer et l'envoyer à <Contact> » (le geste central reprend) ; « Annuler et revenir ».

### 6.11 Changer d'État : Faire entrer…, Remettre au Vivier…, Ajouter au Cercle…, Archiver…

Source : [C04](../battlecrm-cercle/issues/04-gestes-changement-d-etat.md). Remplace « Réactiver… », qui disparaît.

**Une fenêtre, un verbe par destination.** Quatre verbes ouvrent la même fenêtre de conséquences, déjà réglée sur leur cible : **Faire entrer…** (vers En prospection), **Remettre au Vivier…**, **Ajouter au Cercle…** et **Archiver…** (EN *Bring in…, Back to Pool…, Add to Circle…, Archive…*). **Changer d'État…** (EN *Change status…*, touche `S`) reste dans `⋯`, dans la palette, sur la pastille d'État et dans la table, et commence par le choix de la cible. Déclencheurs : bouton plein et `⋯` de la fiche, palette, zones d'État du Funnel, bandeau Entrées d'Aujourd'hui, page Cercle. Motif facultatif partout. Récapitulatif, validation (`Entrée`), puis « Annuler ».

- **Quitter En prospection** : l'Essai en cours doit être réglé (Succès, Sans suite ou Annulé, ce dernier avec un motif). Le choix présélectionné dépend de la cible : Succès vers Allié, Sans suite vers Vivier, aucun vers Archivé. La Relance planifiée est annulée : c'est une ligne du récapitulatif, pas une case à cocher. Le Tirage réservé tombe.
- **Faire entrer…** (depuis Vivier ou Archivé, ou Allié) : l'Étape (la dernière atteinte par défaut ; choix obligatoire si elle est archivée ou si le Contact n'en a pas), puis « Enchaîner : utiliser un Positionnement maintenant », cochée si l'Étape a une Battle ouverte, sinon le lien « Planifier une Relance… ». Un Allié remis En prospection garde sa Relance planifiée. Récapitulatif : « Entrée n°3 cette semaine (3/5) ». `Entrée` valide puis enchaîne.
- **Ajouter au Cercle…** :
  - depuis En prospection : l'Essai à régler (Succès proposé), la Relance annulée, « garde sa dernière Étape atteinte : <Étape> » ;
  - depuis Vivier ou Archivé : rien à régler ;
  - partout : le motif facultatif, le lien « Planifier une Relance… » et le récapitulatif « Cercle 8/10 · prochaines nouvelles d'ici le <date> (Rythme 28 j) » ;
  - depuis la page Cercle : d'abord le choix du Contact (§5.11).
- **Remettre au Vivier…** et **Archiver…** : l'Essai à régler et la Relance annulée s'il y a lieu (depuis En prospection ou Allié), le motif facultatif.
- Un changement d'État est daté de sa saisie ; il ne s'antidate pas ([C02](../battlecrm-cercle/issues/02-objectif-d-entrees-hebdomadaire.md)). Annulé juste après coup, il ne laisse aucune Entrée.

### 6.12 Modifier le Contact

Source : [19](issues/19-ecran-contacts-modifier-contact.md). **Édition sur place du bloc Coordonnées**, partout où il apparaît (page de la fiche, onglet Détails du panneau, volet de Contacts, page mobile) ; pas de panneau de geste.
- **Champs** : nom (seul obligatoire), poste, Organisation (liste filtrée à la frappe, création avec son type, ou « Aucune Organisation »), e-mail, téléphone, URL LinkedIn, note libre.
- **Contrôles pendant la frappe** : URL LinkedIn déjà portée par un autre Contact → enregistrement **bloqué** (« Ce Contact existe déjà : … », « Ouvrir sa fiche »). Même nom (plus précis dans la même Organisation), même e-mail, même téléphone → **information** seulement.
- **Ce qui change**, affiché dès que l'Organisation change : nouvelle Cible, l'Essai en cours garde sa Cible de départ, aucune Interaction enregistrée, Organisation créée le cas échéant.
- L'Étape et l'État n'y figurent pas (fenêtre de conséquences, §6.6 et §6.11).
- `Entrée` enregistre (champ d'une ligne), `Échap` annule ; puis « Annuler ».

### 6.13 Supprimer le Contact…

Source : [19](issues/19-ecran-contacts-modifier-contact.md), [ADR 0006](../../docs/adr/0006-supprimer-un-contact-l-anonymise.md). Sous `⋯` de la fiche, jamais dans une liste.
- **Anonymisation** : nom, poste, coordonnées, note et notes d'Interaction effacés définitivement ; Essais et Interactions conservés sous « Contact supprimé » (Battles, Activité et Taux de passage inchangés). Essai en cours → annulé (« Contact supprimé ») ; Relance planifiée annulée ; URL LinkedIn libérée. Le Contact disparaît de Contacts, du Funnel et de la palette.
- **Fenêtre de confirmation** (irréversible) : « Supprimer <Contact> ? Ses coordonnées et ses notes sont effacées définitivement. Ses n Essais restent dans les Battles, sans son nom. » ; propose **Archiver** à la place pour seulement arrêter la prospection. Supprimer / Annuler.

### 6.14 Prendre des nouvelles…

Source : [C04](../battlecrm-cercle/issues/04-gestes-changement-d-etat.md). Sur un Allié seulement (EN *Check in…*). Déclencheurs : fiche (bouton plein, `I`, `F` hors Relance due), page Cercle, Aujourd'hui, palette (« nouvelles jul »).

Panneau « Prendre des nouvelles de <Contact> » : le canal (E-mail, LinkedIn, Téléphone, Rencontre, Autre), la date (aujourd'hui, hier, autre), une note facultative, le récapitulatif « +1 à l'Activité · Jours sans contact remis à 0 · prochaines nouvelles d'ici le <date> » et le lien « Planifier une Relance… ». `Entrée` valide, puis une notification avec « Annuler ».

- Crée une **Prise de nouvelles** : Interaction sortante, Action de prospection, sans Essai ni Battle. Aucun A/B testing sur les Alliés.
- **Relance d'un Allié** : due ou en retard, le geste affiché est **Relancer…** (§6.3), dont la note sert d'aide-mémoire ; à venir, le panneau propose « Garder la Relance du <date> » (par défaut) ou « L'annuler ». Une Prise de nouvelles ne consomme jamais la Relance.

## 7. Accessibilité

Source : [18](issues/18-accessibilite.md). En plus de ce qui figure plus haut :
- **Rien n'est porté par la couleur, l'intensité ou un motif seuls** (équivalents : phrase de la jauge, tableau de l'Activité et du Funnel, « prouvé » / « désigné » écrits, pastilles libellées ; étoile des Alliés avec le libellé « Allié » ; pour les Alliés, le palier et le nombre de Jours sans contact écrits à côté de la jauge du Rythme).
- **Focus visible** : anneau teal de 2 px avec décalage, au clavier, contraste 3:1, jamais masqué par les éléments collés du mobile. Lien « Aller au contenu », régions repères (menu, contenu, panneau).
- **Annonces** dans une région live polie : notification « Annuler », célébration. Confettis décoratifs.
- **Reflow à 400 %** : tous les écrans restent atteignables et utilisables ; kanban et tableaux larges défilent horizontalement.
- **Cibles** : 24 × 24 px minimum sur bureau, 44 px sur mobile pour les actions rapides.

---

## 8. Exigences pour la stack

Besoins exprimés **sans solution** : le choix de techno revient au wayfinder stack. Chaque exigence porte un identifiant pour être citée par les tickets d'implémentation, et ses tickets sources.

### 8.1 Plateforme, distribution, hors-ligne

| ID | Exigence | Sources |
|---|---|---|
| ST-01 | L'app s'installe sur l'écran d'accueil du téléphone. | 08 |
| ST-02 | La mise en page dépend de la largeur de la fenêtre, pas du type d'appareil. | 18 |
| ST-03 | **Hors-ligne en consultation seulement** : « Aujourd'hui » et les fiches Contact restent lisibles, et « Copier le message » fonctionne. Aucun enregistrement hors ligne : les actions sont désactivées, avec un message qui le dit. | 08 |
| ST-04 | Les données locales (copie de consultation) sont effacées à la déconnexion, et à la reconnexion d'un appareil dont la session a été révoquée. | 16 |
| ST-05 | Une interface bilingue FR/EN dès le départ ; l'attribut de langue de la page suit la langue de l'Utilisateur. | cadrage, 18 |

### 8.2 Comptes et sécurité

| ID | Exigence | Sources |
|---|---|---|
| ST-10 | Inscription ouverte ou fermée par configuration, sans écran d'administration. Une inscription commencée avant la fermeture peut encore être vérifiée. | 16 |
| ST-11 | Envoi d'e-mails transactionnels traduits (langue de l'Utilisateur, ou du sélecteur avant l'inscription) : vérification, « Tu as déjà un compte », réinitialisation, changement d'e-mail, e-mails de sécurité, récupération du second facteur. | 16 |
| ST-12 | Liens à usage unique et à durée limitée (vérification 24 h, réinitialisation 1 h), renvoi avec délai entre deux envois. | 16 |
| ST-13 | Aucune énumération d'adresses (inscription, connexion, mot de passe oublié). | 16 |
| ST-14 | Détection des mots de passe connus pour avoir fuité. | 16 |
| ST-15 | Limitation des tentatives de connexion, par compte et par origine (ralentissement, puis blocage de 15 minutes), sans CAPTCHA. | 16, 18 |
| ST-16 | Sessions longues et glissantes (~90 jours d'inactivité), listées (navigateur, système, dernière activité) et révocables une à une ou toutes sauf la courante ; révocation des autres sessions au changement ou à la réinitialisation du mot de passe. | 16 |
| ST-17 | Détection d'une connexion depuis un nouvel appareil (pour l'e-mail de sécurité). | 16 |
| ST-18 | TOTP, 10 codes de secours à usage unique, régénérables, avec le nombre restant. | 16 |
| ST-19 | Récupération du second facteur par e-mail, différée de 7 jours et annulable, avec alertes. | 16 |
| ST-20 | Réauthentification par mot de passe pour les actions sensibles, même session ouverte. | 16 |
| ST-21 | Effacement des inscriptions non vérifiées au bout de 7 jours. | 16 |
| ST-22 | Retour à la page demandée après la connexion (lien profond). | 16 |
| ST-23 | Isolation stricte des données de chaque Utilisateur. | CONTEXT |

### 8.3 Données et intégrité du modèle

| ID | Exigence | Sources |
|---|---|---|
| ST-30 | Unicité par Utilisateur du nom d'Organisation normalisé (casse, accents, espaces) et de l'URL LinkedIn normalisée (`https`, `www`, barre finale, paramètres). | 15 |
| ST-31 | Fusion d'Organisations (rattachement des Contacts, changement de Cible, Essais commencés inchangés). | 15 |
| ST-32 | Savoir si une Étape a servi (Contact passé, Positionnement, Battle), et si un Positionnement a été utilisé (avec ou sans Essai) : ces faits décident entre supprimer et archiver. | 13, 14 |
| ST-33 | Conserver, à chaque changement d'Étape, l'ordre du Funnel en vigueur, pour lire le sens avant / arrière et calculer le Taux de passage. | 09, CONTEXT |
| ST-34 | Équilibrer le Tirage à la volée par Cible, conserver le Tirage révélé pour un Contact dans une Battle, et tracer sur l'Essai les dérogations (avec motif) et les écarts à la Cadence. | 02, 11, ADR 0002 |
| ST-35 | Téléverser, stocker et télécharger les pièces jointes d'un Positionnement. | 02, 13 |
| ST-36 | Interactions datées indépendamment de leur saisie (dates passées). | 02, 10, 11, 12 |
| ST-37 | Créer les Étapes types dans la langue de l'inscription, avec leur But. | 14, 16 |
| ST-38 | Supprimer un Contact en l'anonymisant : effacement définitif de ses champs identifiants et des notes de ses Interactions (y compris dans les copies locales, et dans les sauvegardes selon leur rétention), en gardant ses Essais et Interactions. | 19, ADR 0006 |
| ST-39 | Historiser chaque changement d'État (date de saisie, jamais antidatée ; motif ; État de départ et d'arrivée ; dernière Étape atteinte à ce moment) et conserver la dernière Étape atteinte d'un Contact hors En prospection, même archivée : Entrées dans le Funnel, sorties par État et par Étape, retour à la dernière Étape, Jours sans contact depuis l'entrée au Cercle. Un changement annulé juste après coup ne laisse aucune trace comptée. | C01, C02, C04, ADR 0007 |

### 8.4 Temps et agrégats

| ID | Exigence | Sources |
|---|---|---|
| ST-40 | Fuseau horaire par Utilisateur, détecté à l'inscription ; un changement s'applique à partir du lendemain, et le fuseau en vigueur de chaque jour est conservé. | 14, 16 |
| ST-41 | Agréger l'Activité par jour dans le fuseau en vigueur, à la date de l'Interaction, sur 12 mois et plus, filtrable par période. | 09 |
| ST-42 | Conserver l'Objectif d'activité en vigueur de chaque jour (une modification s'applique au lendemain). | 09, CONTEXT |
| ST-43 | Calculer le Taux de passage depuis l'historique des changements d'Étape (voir ST-33), filtrable par période. | 09 |
| ST-44 | Savoir si la célébration a déjà eu lieu ce jour-là (fuseau de l'Utilisateur), sur tous ses appareils. | 05 |
| ST-45 | Calculer la Règle de victoire (ADR 0001) pour la jauge, la phrase et les signaux « concluante » et « Horizon atteint ». | 04 |
| ST-46 | Un signal à jour pour la pastille de la navigation et la palette sans saisie : Contacts à traiter (Relances dues ou en retard, Essais délai dépassé) et Alliés à relancer, comptés séparément pour le libellé, et triables ensemble par ancienneté du retard. | 17, C03, C04 |
| ST-47 | Sur « Aujourd'hui », des tirages stables sur la journée et sur tous les appareils : Contacts sans prochaine action, et Contacts du Vivier proposés à l'entrée (un Contact entré est remplacé par un nouveau tirage, et « Un autre » sur mobile en tire un de plus) ; « Plus tard » sur une Battle concluante retenu jusqu'au lendemain, sur tous les appareils. | 01, C03 |
| ST-48 | Calculer les Jours sans contact d'un Allié dans le fuseau de l'Utilisateur, depuis sa dernière Interaction faite (sortante ou entrante), ou depuis son entrée au Cercle s'il n'en a aucune, et en tirer son signal face au Rythme des Alliés (sans signal, « bientôt » dans les 7 derniers jours, « à relancer » au-delà), une Relance planifiée primant sur le Rythme. | C01, C03 |
| ST-49 | Compter les Entrées dans le Funnel par semaine du lundi au dimanche, chaque Entrée rattachée au jour de son enregistrement dans le fuseau en vigueur ce jour-là ; conserver l'Objectif d'entrées en vigueur de chaque semaine, « aucun objectif » compris (une modification s'applique au lundi suivant). | C02, ADR 0003 |

### 8.5 Préférences

| ID | Préférence | Portée | Sources |
|---|---|---|---|
| ST-50 | Langue | Utilisateur | 14 |
| ST-51 | Fuseau horaire | Utilisateur (historisé, ST-40) | 14 |
| ST-52 | Thème Système / Clair / Sombre, en suivant le thème du système en direct | **appareil** | 07, 14 |
| ST-53 | « Célébrer l'Objectif atteint » | Utilisateur | 05 |
| ST-54 | « Raccourcis à une touche » | Utilisateur | 18 |
| ST-55 | Dernier choix kanban / table | **appareil** | cadrage, 03 |
| ST-56 | Réduire les animations | système, sans réglage dans l'app | 07, 14 |
| ST-57 | Rythme des Alliés (28 j) | Utilisateur | C01 |
| ST-58 | Taille visée du Cercle (10, désactivable) | Utilisateur | C01 |

### 8.6 Comportements côté interface

| ID | Exigence | Sources |
|---|---|---|
| ST-60 | Copier dans le presse-papiers (message avec `{prénom}` remplacé, clé TOTP, codes de secours), y compris hors ligne. | 02, 08, 11, 16 |
| ST-61 | Glisser-déposer à la souris (Funnel, réordonnancement des Étapes), avec une alternative au clavier ; pas de glisser tactile. | 03, 08, 14, 18 |
| ST-62 | Annuler juste après coup (au moins 10 s, pause au survol ou au focus, `Ctrl Z`) : enregistrement d'un geste (changement d'État compris), enregistrement automatique d'un réglage, suppression (Étape, Positionnement). | 02, 03, 13, 14, 18, C04 |
| ST-63 | Recherche instantanée sur les Contacts et les Organisations pendant la frappe : palette (Contacts par nom, Organisation, Étape), choix d'Organisation, écran Contacts (nom, Organisation, poste, e-mail). | 15, 17, 19 |
| ST-64 | Vérification des doublons pendant la frappe, sans ralentir la saisie : URL LinkedIn bloquante ; nom, e-mail et téléphone informatifs. | 15, 19 |
| ST-65 | Raccourcis clavier globaux, y compris en séquence (`G` + lettre), qui ne s'activent jamais dans un champ de saisie. | 17, 18 |
| ST-66 | Gestion du focus : piège dans les éléments modaux, retour au déclencheur, entrée dans le panneau non modal. | 18 |
| ST-67 | Régions live pour les annonces. | 18 |
| ST-68 | Couleurs en jetons, jamais codées en dur, pour garantir le contraste AA dans les deux thèmes. | 07 |
| ST-69 | Respect de la préférence système « réduire les animations ». | 07 |
| ST-70 | Conserver l'état d'un panneau ouvert quand on passe dans une autre app sur mobile, puis qu'on revient. | 08 |

### 8.7 Qualité

| ID | Exigence | Sources |
|---|---|---|
| ST-80 | Vérifier chaque écran sans souris, au lecteur d'écran, à 400 % de zoom, dans les deux thèmes, et par un contrôle automatique. | 18 |

### 8.8 Écartés explicitement

Notifications (push ou e-mail) de Relance en retard ; ouverture automatique de l'app du canal ; partage natif ; clés d'accès, lien magique, fournisseur tiers ; export de données et suppression de compte en V1 ; écran d'administration.

---

## 9. Prototypes

Prototypes jetables, basse fidélité, un fichier HTML par branche. Pour en ouvrir un : `git show <branche>:<fichier> > /tmp/p.html`.

| Ticket | Branche | Fichier | Retenu |
|---|---|---|---|
| [01 Aujourd'hui](issues/01-ecran-aujourdhui.md) | `prototype/01-aujourdhui` | `.scratch/battlecrm-ux/prototypes/01-aujourdhui.html` | B (bureau), C (mobile) |
| [02 Geste central](issues/02-geste-utiliser-positionnement.md) | `prototype/02-utiliser-positionnement` | `.scratch/battlecrm-ux/prototypes/02-utiliser-positionnement.html` | `?variant=A2` |
| [03 Funnel](issues/03-vue-funnel-kanban-table.md) | `prototype/03-vue-funnel` | `.scratch/battlecrm-ux/prototypes/03-vue-funnel.html` | `?variant=C`, `&vue=table` |
| [04 Battle](issues/04-lisibilite-battle.md) | `prototype/04-battle` | `.scratch/battlecrm-ux/prototypes/04-battle.html` | `?variant=B` |
| [07 Direction visuelle](issues/07-direction-visuelle.md) | `prototype/07-direction-visuelle` | `.scratch/battlecrm-ux/prototypes/07-direction-visuelle-2.html` (2ᵉ tour ; 1ᵉʳ tour : `07-direction-visuelle.html`) | base A, palette Teal |
| [08 Mobile](issues/08-parcours-mobile.md) | `prototype/08-parcours-mobile` | `.scratch/battlecrm-ux/prototypes/08-parcours-mobile.html` | `?variant=A` |
| [09 Indicateurs](issues/09-ecrans-indicateurs-activite.md) | `prototype/09-indicateurs` | `.scratch/battlecrm-ux/prototypes/09-indicateurs.html` | `?variant=B&ecran=indic` |
| [10 A répondu…](issues/10-enregistrer-reponse-contact.md) | `prototype/10-enregistrer-reponse` | `.scratch/battlecrm-ux/prototypes/10-enregistrer-reponse.html` | `?variant=A` |
| [12 Fiche Contact](issues/12-fiche-contact.md) | `prototype/12-fiche-contact` | `.scratch/battlecrm-ux/prototypes/12-fiche-contact.html` | A (page) et B (panneau), tête du fil de C |
| [13 Positionnements](issues/13-gestion-positionnements.md) | `prototype/13-gestion-positionnements` | `.scratch/battlecrm-ux/prototypes/13-gestion-positionnements.html` | `?variant=C` |
| [17 Navigation bureau](issues/17-navigation-globale-bureau.md) | `prototype/17-navigation-bureau` | `.scratch/battlecrm-ux/prototypes/17-navigation-bureau.html` | `?variant=A` |
| [19 Contacts](issues/19-ecran-contacts-modifier-contact.md) | `prototype/19-ecran-contacts` | `.scratch/battlecrm-ux/prototypes/19-ecran-contacts.html` | `?variant=B` (formulaire sur place ; « Supprimer » non prototypé) |
| [C03 Cercle et Aujourd'hui](../battlecrm-cercle/issues/03-page-cercle-et-aujourdhui.md) | `prototype/03-page-cercle` | `.scratch/battlecrm-cercle/prototypes/03-page-cercle.html` | page Cercle `?variant=B`, Aujourd'hui `?variant=C` (`&ecran=today|cercle&largeur=bureau|mobile`) |

Sans prototype (grilling) : [05](issues/05-detachement-reponses-negatives.md), [06](issues/06-vocabulaire-anglais.md), [11](issues/11-relance-faite-aide-memoire.md), [14](issues/14-reglages.md), [15](issues/15-organisations.md), [16](issues/16-parcours-authentification.md), [18](issues/18-accessibilite.md).

**Pour le développement : cette spec fait foi, jamais un prototype.** Un prototype montre une mise en page ; dès qu'il diverge de la spec (États, libellés, couleurs), on suit la spec. Les prototypes ne font pas foi sur ce que les tickets ont amendé après coup : « Faite » et « J'ai relancé » (01, 03) sont devenus « Relancer… » ; le vert plein de l'Historique (04) est devenu teal ; les écrans « sur ordinateur seulement » (08, 13) sont empilés sous Plus. Depuis la carte Cercle d'alliés (2026-10-06), les prototypes 01 à 19 montrent encore les anciens États : la colonne Vivier du Funnel, actif / en pause / clos / gagné, « Réactiver… », la proposition de clore et le filtre d'État du Funnel ne font plus foi (§5, §6.11).

## 10. Microcopie de référence

| Situation | FR |
|---|---|
| Essai sans suite | « Essai sans suite : un point de donnée de plus pour la Battle “<Étape>” (14/20 terminés). » |
| Proposition de remettre au Vivier | « Remettre <Contact> au Vivier ? Il reviendra dans les propositions d'entrée. » — Remettre au Vivier / Garder En prospection / Archiver |
| Fiche archivée | « Rien n'est définitif : tu peux le faire revenir. » |
| Faire entrer (récapitulatif) | « Entrée n°3 cette semaine (3/5) » |
| Ajouter au Cercle (récapitulatif) | « Cercle 8/10 · prochaines nouvelles d'ici le <date> (Rythme 28 j) » |
| Prendre des nouvelles (récapitulatif) | « +1 à l'Activité · Jours sans contact remis à 0 · prochaines nouvelles d'ici le <date> » |
| Notifications d'État | « <Contact> entre dans le Funnel à <Étape> · Entrées 3/5 » ; « <Contact> entre au Cercle · 8/10 » ; « <Contact> est remis au Vivier » ; « <Contact> est archivé » ; « Nouvelles de <Contact> notées · prochaines d'ici le <date> » (toutes avec « Annuler ») |
| Allié à relancer (Aujourd'hui) | « Rythme dépassé (n j) · n j sans contact » |
| Cercle vide | « Ton Cercle est vide. Ajoute les ingénieurs d'affaires avec qui tu veux garder le contact, même pendant une mission. » |
| Pastille d'Aujourd'hui (infobulle) | « 3 à traiter, 2 Alliés à relancer » |
| Nouveau Champion | « X devient Champion de “<Étape>” » puis « Y est archivé, il peut revenir comme Challenger » |
| Titre défendu | « Y garde son titre ; X est archivé. » |
| Égalité | « Pas d'écart détectable entre X et Y : à ce volume, seul un écart important se voit. Les deux se valent probablement ; X garde son titre. » |
| Données insuffisantes | « Trop peu de succès pour départager X et Y. » |
| Enseignement | « Qu'en retiens-tu ? » |
| Célébration | « Bravo, objectif du jour atteint ! 3 / 3 » |
| Réordonner le Funnel | « Réordonner ne déplace aucun Contact ; l'historique garde l'ordre d'alors. » |
| Mot de passe | « 15 caractères minimum. Une phrase fait très bien l'affaire. » |
| Mot de passe fuité | « Ce mot de passe apparaît dans des fuites de données connues, choisis-en un autre. » |
| Mot de passe oublié | « Si un compte existe pour cette adresse, un lien vient de partir. » |
| Supprimer un Contact | « Supprimer <Contact> ? Ses coordonnées et ses notes sont effacées définitivement. Ses n Essais restent dans les Battles, sans son nom. » |
| Doublon LinkedIn | « Ce Contact existe déjà : Jean Dupont · Capgemini » — Ouvrir sa fiche |
| Inscriptions fermées | « Les inscriptions sont fermées pour le moment. » |
| Trop de tentatives | « Trop de tentatives. Réessaie dans 15 minutes, ou réinitialise ton mot de passe. » |

Les libellés exacts des prototypes 04 et 09 ont été validés en bloc et restent ajustables.

---

## 11. Arbitrages entre tickets

| Sujet | Tickets | Retenu |
|---|---|---|
| Action de Relance | 01 « Faite », 03 « J'ai relancé », 11 « Relancer… » | **Relancer…** partout (11). |
| Portée du thème | 07 « par Utilisateur », 14 « par appareil » | **Par appareil** (14). Précision ajoutée au ticket 07. |
| Couleur du Champion prouvé | 04 « fond vert plein », 07 « teal » | **Teal** : le vert est réservé au Succès d'un Essai. Précision ajoutée au ticket 04. |
| Écrans « sur ordinateur seulement » | 08, 13 | **Atteignables en version empilée** sous Plus (18, reflow). |
| Raccourcis `R` (reporter) et `S` (sans suite) | 01 (piste) | **Abandonnés** (arbitrage du 2026-10-01). Précision ajoutée au ticket 01. |
| Synthèse du graphe d'Activité | 05 « pas de marque Objectif atteint », 18 « Objectif atteint 61 jours » | **Retirée** : « 214 actions sur 12 mois » (arbitrage du 2026-10-01). Précision ajoutée au ticket 18. |
| Fiche depuis Contacts ; « Modifier le Contact » | 12 « page » et « Modifier » en panneau de geste, 19 | **Panneau ancré** dans Contacts ; **édition sur place** des Coordonnées partout (19). Précision ajoutée au ticket 12. |
| Champs de l'ajout rapide | 15 (nom, Organisation, LinkedIn, Étape), 19 (poste, e-mail, téléphone, note) | **Minimal, avec « Plus de champs »** ; doublons alignés sur « Modifier le Contact » (arbitrage du 2026-10-01). Précision ajoutée au ticket 19. |
| Libellé de la pastille d'Aujourd'hui | C03 « n à traiter » comptant les Alliés, glossaire « à traiter » réservé à En prospection | **Le glossaire ne change pas** : la pastille n'affiche qu'un nombre, l'infobulle dit « 3 à traiter, 2 Alliés à relancer » (C04). |
| Propositions du Vivier | C03 : 3 ou 4 sur bureau, une à la fois avec « Un autre » sur mobile ; un Contact entré « sans être remplacé » | **Les deux**, selon la largeur (C03). Un Contact entré **est remplacé** par un nouveau tirage (relecture du 2026-10-06). Précision ajoutée au ticket C03. |
| États dans les écrans d'origine | 01, 03, 12, 17, 19 (actif, en pause, clos, gagné ; Vivier en Étape) | **Remplacés** par Vivier, En prospection, Allié, Archivé (carte Cercle d'alliés, ADR 0007). |

## 12. Écarts entre l'UX et le modèle

Règles que les tickets UX avaient ajoutées ou modifiées sans les consigner. **Toutes sont tranchées et consignées le 2026-10-01** ; `CONTEXT.md` et `docs/adr/` font foi.

| # | Sujet | Décision | Consigné dans |
|---|---|---|---|
| E1 | Répartition par tirage | Nouveau terme **Tirage** (EN *Assignment*) : équilibré à la volée parmi les Contacts de la même Cible, réservé au Contact sans nouveau tirage tant que la Battle est ouverte et que le Contact reste actif à l'Étape ; un changement de Cible ne le refait pas ; un Positionnement à l'Horizon n'est plus tiré ; **dérogation** (EN *Override*) permise et tracée sur l'Essai. | `CONTEXT.md` (Tirage, Essai), [ADR 0002](../../docs/adr/0002-tirage-reserve-sans-re-tirage-derogation-tracee.md) |
| E2 | Utilisation sans Essai pendant une Battle ouverte | Pas d'Essai si : pas de Battle ouverte, Contact non actif, hors de la Cible d'une Battle restreinte, déjà un Essai dans cette Battle, Horizon atteint des deux côtés. Dans ces cas, le geste central propose le Champion. | `CONTEXT.md` (Essai), ADR 0002 |
| E3 | Prochaine action | Trois termes : **À traiter** (*Needs action*), **En attente** (*Waiting*), **Sans prochaine action** (*No next step*), dans cet ordre de priorité. | `CONTEXT.md` (Prospection) |
| E4 | Changements d'Étape et d'État | Ni sortants ni entrants : ils ne touchent ni la Cadence ni le Délai de réponse. Le Délai de réponse se compte depuis la dernière Interaction **sortante faite ou entrante**. | `CONTEXT.md` (Interaction, Délai de réponse) |
| E5 | Changer d'Étape | Réservé au Contact actif. | `CONTEXT.md` (État) |
| E6 | Changer d'Organisation | N'est pas une Interaction. | `CONTEXT.md` (Contact) |
| E7 | Fuseau horaire | Fuseau en vigueur ce jour-là, changement à partir du lendemain. | `CONTEXT.md` (Activité), [ADR 0003](../../docs/adr/0003-historique-valeurs-en-vigueur.md) |
| E8 | Étape d'entrée | Première Étape non archivée **ou Étape choisie** ; les Étapes qui précèdent ne comptent pas comme sautées (hors de leur Taux de passage). L'entrée est une Interaction. | `CONTEXT.md` (Contact, Funnel, Interaction) |
| E9 | Étape restaurée | À sa place d'avant, sinon en fin de Funnel. | `CONTEXT.md` (Étape) |
| E10 | Canal | Nouveau terme **Canal** (*Channel*) : e-mail, LinkedIn, téléphone, courrier. | `CONTEXT.md` (Prospection) |
| E11 | Horizon dans l'ADR 0001 | « Commencés (hors annulés) » et « conclut » au lieu de « ferme ». | [ADR 0001](../../docs/adr/0001-regle-de-victoire-bayesienne-sans-verrou.md) |
| E12 | Dupliquer | Dupliquer un Positionnement, même jamais utilisé, crée une copie modifiée (lien « dérivé de », lignée). | `CONTEXT.md` (Positionnement) |
| E13 | Champs du Contact | Seul le nom est obligatoire ; s'y ajoutent poste, e-mail, téléphone et note libre (contexte permanent, distinct des notes d'Interaction). Seule l'URL LinkedIn est unique : un même nom, e-mail ou téléphone est permis. | `CONTEXT.md` (Contact) |
| E14 | Supprimer un Contact | Anonymisation : nom, coordonnées et notes effacés, Essais et Interactions gardés sous « Contact supprimé » ; Essai en cours annulé (motif « Contact supprimé »), Relance planifiée annulée, URL LinkedIn libérée. | `CONTEXT.md` (Contact), [ADR 0006](../../docs/adr/0006-supprimer-un-contact-l-anonymise.md) |

Également consigné : une Interaction entrante ne porte aucune nature (`CONTEXT.md`, Interaction ; [ADR 0005](../../docs/adr/0005-interaction-entrante-sans-nature.md)).

**Depuis le 2026-10-06** (ADR 0007), dans ce tableau, « actif » se lit En prospection (E1, E2, E5). Le Vivier n'est plus une Étape : l'Étape d'entrée (E8) d'un nouveau Contact ajouté En prospection est la première Étape non archivée, Approche dans les Étapes types.

## 13. ADR

Écrits le 2026-10-01 dans `docs/adr/` :
- [0002 — Tirage réservé, sans nouveau tirage, avec dérogation tracée](../../docs/adr/0002-tirage-reserve-sans-re-tirage-derogation-tracee.md)
- [0003 — L'historique conserve les valeurs en vigueur au moment des faits](../../docs/adr/0003-historique-valeurs-en-vigueur.md)
- [0004 — Hors-ligne en consultation seulement](../../docs/adr/0004-hors-ligne-en-consultation-seulement.md)
- [0005 — Une Interaction entrante n'a pas de nature](../../docs/adr/0005-interaction-entrante-sans-nature.md)
- [0006 — Supprimer un Contact l'anonymise](../../docs/adr/0006-supprimer-un-contact-l-anonymise.md)

Écrit le 2026-10-06 (carte Cercle d'alliés) :
- [0007 — Les États Vivier, En prospection, Allié et Archivé remplacent actif, en pause, clos et gagné](../../docs/adr/0007-etats-vivier-en-prospection-allie-archive.md)
- ADR 0003 amendé : l'Objectif d'entrées conserve sa valeur en vigueur semaine par semaine.

Envisagés sans être retenus comme ADR (décisions de produit, réversibles, consignées dans cette spec) : WCAG 2.2 AA en entier ; e-mail et mot de passe seulement ; pas de rouge pour les résultats (réservé aux erreurs) ni de taux personnels.

## 14. Pas encore spécifié

- **Suppression de compte** écartée en V1 : à confronter au droit à l'effacement (RGPD) avant d'ouvrir les inscriptions à des tiers.

## 15. Hors périmètre

Choix de stack, architecture et déploiement (wayfinder stack) ; objet **Opportunité** (mission remontée par un Allié, carte Cercle d'alliés : rien ne doit le bloquer) ; A/B testing des Prises de nouvelles ; maquettes haute fidélité et design system détaillé ; import de Contacts et extension Firefox LinkedIn ; notifications push et e-mail comme solutions ; export de données et suppression de compte en V1 ; clés d'accès, lien magique, fournisseur tiers ; administration.
