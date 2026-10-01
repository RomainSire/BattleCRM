# Navigation globale (bureau)

Type: prototype
Status: resolved
Blocked by: 12, 13, 14, 15

## Question

Quelle est la structure de navigation sur bureau : entrées du menu latéral, place et contenu de la palette de commandes (`Ctrl K`), ajout rapide (`N`), et raccourcis globaux ?

Déjà tranché : « Aujourd'hui » est l'écran d'arrivée ; « Battles » est un écran à deux onglets (Battles, Historique des Champions) ; « Indicateurs » a sa propre entrée. Le mobile est tranché (onglets Aujourd'hui, Contacts, Funnel, Plus ; bouton + ; loupe comme palette, voir le ticket « Parcours mobile ») : la navigation bureau doit rester cohérente avec lui. La fiche Contact est une page (depuis Contacts, la palette, un lien) et un panneau latéral (depuis le Funnel et « Aujourd'hui »), avec les raccourcis `U`, `F`, `I`, `P` (ticket « Fiche Contact »). Le reste dépend de l'inventaire des écrans (Positionnements, Réglages). L'Organisation a une page légère **sans entrée de menu**, ouverte en cliquant son nom ou depuis la palette (ticket « Organisations ») : la palette doit donc chercher les Organisations.

## Answer

Tranché avec Romain le 2026-10-01, sur le prototype.

- Prototype jetable (variantes A « Barre latérale », B « Rail + palette », C « Barre du haut » ; palette, ajout rapide et aide clavier communs ; état affiché) : branche `prototype/17-navigation-bureau`, fichier `.scratch/battlecrm-ux/prototypes/17-navigation-bureau.html` (`git show prototype/17-navigation-bureau:.scratch/battlecrm-ux/prototypes/17-navigation-bureau.html > /tmp/p.html`, puis `?variant=A`).

**Structure : la variante A, une barre latérale à gauche avec les libellés visibles.** B (rail d'icônes) et C (onglets en haut) sont écartées.
- **En haut du menu** : la marque, un champ « Rechercher… » qui ouvre la palette (`Ctrl K` affiché), puis le bouton **« + Ajouter »** (`N`).
- **Deux groupes nommés** : **Prospection** (Aujourd'hui, Contacts, Funnel), puis **Expérimentation** (Battles, Positionnements, Indicateurs). L'ordre suit l'usage quotidien, puis le pilotage.
- **En bas du menu** : Réglages, « Raccourcis » (`?`), puis l'adresse du compte et « Se déconnecter ».
- **Pastilles** : un compteur **ambre** sur Aujourd'hui (Relances dues ou en retard, Essais délai dépassé), un **point teal** sur Battles quand une Battle est concluante. Rien d'autre ne porte de pastille. Ça reste compatible avec le ticket « Détachement des réponses négatives dans l'UX » : c'est un compte de choses à faire, jamais un taux ni du rouge.
- **Pages sans entrée de menu** : la fiche Contact en page et la page Organisation allument l'entrée **Contacts**, avec un fil d'Ariane « Contacts › … ». La fiche s'ouvre en panneau depuis Aujourd'hui et le Funnel, avec « Ouvrir en page » ; en page depuis Contacts, la palette ou un lien (comme décidé dans le ticket « Fiche Contact »).
- **Cohérence avec le mobile** : les onglets du mobile (Aujourd'hui, Contacts, Funnel) correspondent au groupe Prospection. Le reste passe sous Plus, comme sur le bureau dans Expérimentation et en bas du menu.

**Palette de commandes (`Ctrl K`, ou `/`)** : une fenêtre centrée.
- **Sans saisie**, elle affiche d'abord les **Contacts à traiter** (Relances dues ou en retard, Essais délai dépassé).
- **Pendant la frappe**, elle donne les résultats par groupe : **Contacts** (nom, Organisation, Étape), **Organisations**, **Actions**, **Créer** (Ajouter un Contact, Noter une Interaction…, Créer un Positionnement, Ouvrir une Battle…), **Aller à** (les écrans, avec leur raccourci) et **Préférences et autres** (Historique des Champions, basculer kanban/table, thème, langue, raccourcis, se déconnecter).
- **Deux façons d'agir sur un Contact, gardées toutes les deux** :
  - **Contact d'abord** : `→` ou `Tab` sur un Contact ouvre ses actions : Ouvrir la fiche, Relancer…, A répondu…, Utiliser un Positionnement, Noter une Interaction, Planifier une Relance, Changer d'Étape…, Changer d'État…, Ouvrir l'Organisation. `⌫` dans le champ vide revient en arrière.
  - **Verbe d'abord** : « relancer jul », « répondu kar », « utiliser… », « noter… » proposent directement « Relancer · Julie Martin ».
  - `Entrée` sur un Contact ouvre sa fiche en page.
- Sans résultat, la palette propose d'**ajouter ce nom comme Contact**.
- Chaque action ouvre le panneau déjà tranché par son ticket (geste central, « A répondu… », « Relancer… », fenêtre de conséquences).

**Ajout rapide (`N`, « + Ajouter », ou la palette)** : la fenêtre d'ajout d'un Contact du ticket « Vue Funnel : kanban et table ». `Entrée` ajoute, `Ctrl Entrée` ajoute puis enchaîne sur « Utiliser un Positionnement ». Une Interaction se note depuis la palette (« Noter une Interaction… », puis le Contact) ou avec `I` sur la fiche.

**Raccourcis globaux** (rappelés dans l'aide `?` et dans les infobulles du menu) :
- Partout : `Ctrl K` ou `/` ouvre la palette ; `N` ajoute un Contact ; `?` affiche l'aide ; `Échap` ferme le panneau, la fenêtre ou le menu.
- **Aller à : `G` puis une lettre** : `G A` Aujourd'hui, `G C` Contacts, `G F` Funnel, `G B` Battles, `G P` Positionnements, `G I` Indicateurs, `G R` Réglages. Après `G`, un repère « G … » s'affiche le temps de taper la lettre.
- Sur une fiche Contact (page ou panneau) : `F` Relancer…, `U` Utiliser un Positionnement, `I` Noter une Interaction, `P` Planifier / Modifier la Relance. Dans le Funnel : `V` bascule kanban/table.
- Les raccourcis à une lettre ne s'activent jamais dans un champ de saisie.

**Pour la stack** : une recherche instantanée sur les Contacts et les Organisations pendant la frappe, et des raccourcis clavier qui ne gênent pas la saisie.
