# Parcours mobile

Type: prototype
Status: resolved
Blocked by: 01, 02, 11

## Question

Comment se déroulent sur mobile les actions rapides : voir les Relances du jour, marquer une Relance faite, enregistrer une Interaction, régler un Essai, utiliser un Positionnement ?

À trancher :
- Ce qui est **disponible** sur mobile, ce qui y est dégradé et ce qui n'y est pas (conception d'un Positionnement, ouverture d'une Battle).
- Navigation mobile : barre du bas, bouton d'ajout flottant ?
- Besoins à remonter en exigences pour la stack (hors-ligne, installation sur l'écran d'accueil, rappels).

Point de départ : l'écran « Aujourd'hui » mobile est déjà tranché (« une chose à la fois », voir le ticket « Écran « Aujourd'hui » »). Il reste à décider tout ce qui l'entoure. Le geste central est tranché sur bureau (panneau en 3 étapes, voir le ticket « Geste central : utiliser un Positionnement ») : reste à décider sa forme sur mobile. « A répondu… » est tranché sur bureau (panneau en 3 étapes, voir le ticket « Enregistrer une réponse du Contact ») : même question pour sa forme sur mobile. De même pour le panneau « Relancer… » en 2 étapes (voir le ticket « Relance faite : aide-mémoire du message »), où copier le message et le coller dans une autre app est le cœur du geste sur mobile.

## Assets

- Prototype jetable (variantes A, B, C ; passage simulé dans LinkedIn ; état affiché) : branche `prototype/08-parcours-mobile`, fichier `.scratch/battlecrm-ux/prototypes/08-parcours-mobile.html` (`git show prototype/08-parcours-mobile:.scratch/battlecrm-ux/prototypes/08-parcours-mobile.html > /tmp/p.html`, puis `?variant=A`).

## Answer

Tranché avec Romain le 2026-09-30, sur le prototype.

**Forme : variante A « Onglets + plein écran ».** Elle est plus chargée que les autres, mais elle couvre tous les cas : moins de risque de frustrer l'Utilisateur. On a écarté le pas à pas (B : un écran par étape, « Copier et ouvrir <canal> », retour direct sur « Confirme ») et la version « Aujourd'hui + recherche » sans onglets (C : feuille du bas compacte, étapes faites repliées).

**Navigation mobile :**
- une **barre d'onglets en bas** : Aujourd'hui (écran d'arrivée), Contacts, Funnel, Plus ;
- un **bouton + flottant** au-dessus de la barre, qui ouvre « Ajouter » : Ajouter un Contact (seul le nom est obligatoire), Noter une Interaction… ;
- une **loupe** dans l'en-tête, qui est la palette de commandes du mobile : elle cherche Contacts et actions (« Utiliser un Positionnement · <Contact> », « A répondu · <Contact> », « Relancer · <Contact> »).

**Panneaux sur mobile** : les panneaux latéraux du bureau (« Envoyer à… », « <Contact> a répondu », « Relancer <Contact> ») deviennent une **feuille plein écran** avec le même contenu. Les étapes numérotées restent empilées dans une même page qui défile, et le bouton de validation reste collé en bas (« C'est envoyé », « Enregistrer la réponse », « Relance faite »), avec « Plus tard » quand le geste de bureau l'a. Un ✕ en haut ferme la feuille. Il n'y a pas de variante propre au mobile : on garde une seule forme par geste. Le message se copie par un bouton « Copier le message », et l'Utilisateur passe lui-même dans l'app du canal. On ne retient ni l'ouverture automatique de l'app du canal ni le partage natif. Au retour, la feuille est restée ouverte là où il l'avait laissée. Les fenêtres courtes (Sans suite avec proposition de clore, clôture d'une Battle) suivent la même forme.

**Ce qui est sur mobile** (répartition du menu Plus) :
- **Complet** : « Aujourd'hui » (une chose à la fois, déjà tranché), Contacts et fiche Contact, les gestes rapides (Relancer…, A répondu…, Utiliser un Positionnement, Sans suite, Reporter), l'ajout rapide et la palette.
- **Dégradé** : le **Funnel** devient une **liste groupée par Étape**, sans kanban, sans glisser-déposer et sans vue table. On change d'Étape depuis la fiche Contact. Les **Battles** sont consultables et se clôturent. Les **Indicateurs** sont consultables (déjà tranché : rien de plus sur mobile). Seuls les **Réglages simples** y sont (langue, thème, célébration).
- **Sur ordinateur seulement** (listé sous « Sur ordinateur » dans Plus) : créer ou dériver un Positionnement, ouvrir une Battle, éditer le Funnel.
  - **Amendé par le ticket « Accessibilité » (reflow WCAG 1.4.10)** : ces écrans ne sont plus réservés à l'ordinateur. En largeur étroite, ils restent atteignables et utilisables en version empilée sous Plus, mais ne sont ni pensés pour le téléphone ni mis en avant.

**Exigences pour la stack :**
- l'app s'**installe sur l'écran d'accueil** du téléphone ;
- **hors-ligne en consultation seulement** : « Aujourd'hui » et les fiches Contact restent lisibles hors connexion, et le bouton « Copier le message » y fonctionne. Aucun enregistrement n'est possible hors-ligne : les actions sont désactivées, avec un message qui le dit.
- Écartés : rappel de Relance en retard (pas de notification), ouverture de l'app du canal, partage natif.
