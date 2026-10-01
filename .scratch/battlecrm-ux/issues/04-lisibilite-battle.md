# Écran Battle et Historique des Champions

Type: prototype
Status: resolved
Blocked by: 

## Question

Comment l'Utilisateur ouvre, suit et clôt une Battle, puis relit l'Historique des Champions d'une Étape ?

Déjà acquis : phrase en langage naturel, jauge vers le seuil, progression vers le minimum d'Essais et l'Horizon, pas de distribution brute par défaut.

À trancher :
- **Ouverture** : choix du Challenger, du Critère de succès, de la restriction de Cible, du seuil et de l'Horizon (réglages avancés repliés ?).
- **Suivi** : où vivent les Battles ouvertes (écran dédié, par Étape) ; liste des Essais et de leurs issues ; ventilation par Cible.
- **Clôture** : signal « concluante », confirmation, vainqueur désigné contre la règle (avertissement), Verdict, saisie de l'Enseignement.
- **Historique des Champions** : présentation de la progression, distinction entre ce que les données ont prouvé et ce que l'Utilisateur a désigné.

## Assets

- Prototype jetable (variantes A, B, C ; fenêtre de clôture commune ; `+4 Essais` pour faire avancer une Battle) : branche `prototype/04-battle`, fichier `.scratch/battlecrm-ux/prototypes/04-battle.html` (`git show prototype/04-battle:.scratch/battlecrm-ux/prototypes/04-battle.html > /tmp/p.html`, puis `?variant=B`).

## Answer

Tranché avec Romain le 2026-09-29, sur le prototype : **variante B « Vue d'ensemble »**, retenue telle quelle.

**Où vivent les Battles : une vue d'ensemble.** L'écran « Battles » a deux onglets, **Battles** et **Historique des Champions**. L'onglet Battles montre toutes les Étapes du Funnel, une ligne chacune :
- **Battle ouverte** : l'Étape, « Champion vs Challenger », la phrase en langage naturel, une mini-jauge, « n+n terminés · n succès », et à droite l'état (« trop tôt », « en cours ») ou le bouton **Clôturer…** quand la Battle est concluante ou que l'Horizon est atteint.
- **Pas de Battle** : « Pas de Battle. Champion : <Positionnement> » (ou « ni de Champion ») et le bouton **Ouvrir une Battle…**.

**Suivi : un panneau latéral.** Cliquer une ligne ouvre le panneau de l'Étape, avec quatre onglets :
- **Suivi** : la phrase, le bandeau « Concluante » ou « Horizon atteint » avec « Clôturer la Battle… », la jauge, la progression (Essais terminés vers le minimum de 10 par Positionnement, Essais commencés vers l'Horizon, succès au total vers 5), puis le Critère de succès, la Cible, le seuil, l'Horizon et la date d'ouverture. Si la Battle n'est pas concluante : « Clôturer quand même… ».
- **Essais** : Contact, Positionnement, date de début et issue, modifiable en ligne tant que la Battle est ouverte, avec le rappel du Critère de succès.
- **Par Cible** : succès sur Essais terminés, par Cible et par Positionnement, marqué « à titre indicatif » (le Verdict porte sur l'ensemble).
- **Historique** : celui de l'Étape.

**Phrase et jauge.** La phrase suit l'état : « trop tôt » (qui mène, ce qui manque encore pour le minimum), « X a n % de chances de faire mieux que Y, il en faut 85 % », « concluante », « Horizon atteint : égalité » ou « données insuffisantes ». La jauge montre la probabilité que le Challenger soit meilleur, avec les deux zones de seuil aux extrémités, du côté du Champion et du côté du Challenger. **Tant que le minimum n'est pas atteint, elle reste visible mais grisée et hachurée, marquée « indicatif »** : Romain préfère cela à la cacher.

**Ouverture : un assistant en 3 étapes**, dans le panneau :
1. **Qui affronte qui** : le Champion rappelé, le Challenger choisi parmi les Positionnements de l'Étape. Les archivés y figurent, marqués « revient comme Challenger ». Le lien « + Créer un Positionnement » renvoie à la gestion des Positionnements. Pour la première Battle d'une Étape, on désigne d'abord le Champion initial.
2. **Ce qui compte comme succès** : le Critère de succès, repris de la Battle précédente de l'Étape, avec des suggestions. On rappelle qu'on valide chaque succès à la main et que le critère ne change plus.
3. **Réglages et confirmation** : restriction de Cible, seuil (85 % par défaut) et Horizon (25), avec le rappel qu'ils sont figés et que le minimum n'est pas réglable. Puis un récapitulatif en une phrase (« On saura si X fait mieux que Y pour « … » ; chaque Contact qui atteint l'Étape recevra l'un des deux, tiré au sort ») et **Ouvrir la Battle**.

**Clôture : une fenêtre**, depuis la ligne, le panneau ou l'écran « Aujourd'hui » (« Clôturer… » d'une Battle concluante) :
- Les choix possibles, avec **le Verdict de la Règle de victoire présélectionné** et marqué comme tel : victoire du Challenger ou titre défendu si la Battle est concluante ; égalité ou données insuffisantes si l'Horizon est atteint. On peut aussi déclarer l'un ou l'autre vainqueur, ou abandonner la Battle.
- **Vainqueur contre la règle** : un avertissement dit pourquoi la règle n'est pas satisfaite (probabilité ou minimum non atteint) et que le Verdict sera marqué « désigné par l'Utilisateur ». Il faut cocher « Je désigne ce vainqueur quand même » pour pouvoir clôturer.
- **Abandon** : une note dit qu'abandonner signifie que la Battle n'a rien appris, et invite à dire pourquoi dans l'Enseignement.
- **Conséquences** : qui devient ou reste Champion, qui est archivé (ou, en cas d'abandon, que le Challenger reste disponible), les Essais en cours qui passent en annulé (« Battle clôturée ») sans toucher aux Relances, et le retour à l'utilisation du Champion sans Essai.
- **Enseignement** : champ libre et facultatif, modifiable ensuite depuis l'Historique.
- Boutons **Clôturer** et **Plus tard**.

**Historique des Champions : une lignée par Étape**, dans son onglet. Pour chaque Étape, une suite horizontale de cases, du Champion initial à la Battle en cours. Chaque case donne le Champion, la date et l'Enseignement. Les flèches entre les cases portent le Verdict (« prouvé 91 % », « désigné », « égalité vs … »). Pour distinguer **prouvé** et **désigné** :
- **prouvé par les données** : case à **fond vert plein** ;
- **désigné par l'Utilisateur** (Champion initial ou vainqueur contre la règle) : case **légèrement hachurée**, bord en pointillés. C'est une suggestion de Romain, reportée dans le prototype. Romain trouvait la distinction « pas hyper claire, mais ça passe une fois qu'on le sait » ; les hachures la renforcent ;
- **titre conservé** (titre défendu, égalité, abandon) : case neutre.
Une légende sous les lignées rappelle ce code.

**Hérité du prototype par défaut, non discuté en détail** : les libellés exacts, le contenu des onglets Essais et Par Cible, et le détail de la fenêtre de clôture. Ils ont été validés en bloc avec la variante B et restent ajustables quand la direction visuelle sera fixée.

**Exigences pour la stack** : aucune nouvelle. Le calcul de la Règle de victoire est défini par l'ADR 0001.

**Précision (ticket [Réglages](14-reglages.md))** : quand l'Étape n'a encore jamais eu de Battle, le Critère de succès est pré-rempli avec le But de l'Étape, s'il existe.

**Précision (ticket [Direction visuelle](07-direction-visuelle.md))** : le Champion prouvé a un fond **teal** plein, pas vert : le vert est réservé au Succès d'un Essai.
