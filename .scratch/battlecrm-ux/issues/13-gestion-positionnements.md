# Gestion des Positionnements

Type: prototype
Status: resolved
Blocked by: 

## Question

Comment l'Utilisateur crée, dérive, consulte et archive ses Positionnements (sur ordinateur seulement) ?

À trancher :
- Où vivent les Positionnements : un écran propre, un onglet par Étape, dans l'écran Battles ?
- La création : contenu, canal, pièces jointes, Cadence de relance (Cadence par défaut proposée) et un message facultatif par rang de Cadence.
- La **dérivation** d'un Positionnement existant, seul moyen de modifier ce qui est figé depuis son premier Essai (contenu, Cadence, messages de relance) : comment l'app le fait comprendre sans jargon.
- La consultation des Positionnements archivés.
- Le retour vers l'assistant d'ouverture d'une Battle : son lien « + Créer un Positionnement » mène ici et doit y revenir (ticket « Écran Battle et Historique des Champions »).
- Le cas « Étape sans Positionnement », où le geste central propose « Créer un Positionnement pour cette Étape » (ticket « Geste central : utiliser un Positionnement »).

## Assets

- Prototype jetable (variantes A « Écran propre », B « Dans Battles », C « Atelier » ; entrées depuis la navigation, l'ouverture d'une Battle et le geste central ; état affiché) : branche `prototype/13-gestion-positionnements`, fichier `.scratch/battlecrm-ux/prototypes/13-gestion-positionnements.html` (`git show prototype/13-gestion-positionnements:.scratch/battlecrm-ux/prototypes/13-gestion-positionnements.html > /tmp/p.html`, puis `?variant=C`).

## Answer

Tranché avec Romain le 2026-10-01, sur le prototype : **variante C « Atelier »**, retenue telle quelle.

**Où : un écran « Positionnements » à part**, avec sa propre entrée de navigation (sur ordinateur seulement, ticket « Parcours mobile »). C'est une page maître-détail à trois colonnes :
- **Étapes** du Funnel, chacune avec son nombre de Positionnements non archivés ;
- **Positionnements de l'Étape choisie, en lignées** : chaque copie modifiée s'affiche sous son original, décalée (↳). Une ligne donne le libellé, le badge Champion ou Challenger, le canal, la Cadence en abrégé (« +3 j, +7 j, +14 j puis 14 j »), les pièces jointes, et « 🔒 n Essais · figé » ou « jamais utilisé · modifiable ». Le bouton plein « + Nouveau » est en tête de colonne ;
- **la fiche** du Positionnement choisi, affichée sur place : contenu, pièces jointes, chaque Relance avec son délai et son message (ou « sans message »), le Délai de réponse, l'utilisation, les liens vers l'original et vers les copies.
On a écarté l'écran à cartes par Étape avec la fiche en panneau (A) et l'onglet dans le panneau d'une Étape de l'écran Battles (B).

**Création : un panneau latéral** (« + Nouveau », ou « Créer le premier » quand l'Étape est vide) :
- Étape (verrouillée quand on vient d'une Étape précise), libellé, **canal** en puces (E-mail, LinkedIn, Téléphone, Courrier ; « un autre canal, c'est un autre Positionnement ») ;
- **« Ce que tu envoies »** : le texte à copier, avec « insérer {prénom} », remplacé au moment de copier ;
- pièces jointes (« + Ajouter un fichier ») ;
- **« Relances si pas de réponse »** : une ligne par rang (Relance n, « après n j », message facultatif, ✕ pour retirer), « + Ajouter une Relance », puis le Délai de réponse et son explication. Les champs sont pré-remplis avec la Cadence par défaut des Réglages, ce que le formulaire signale. On rappelle que chaque délai se compte depuis la dernière Interaction sortante ;
- une note : tout reste modifiable jusqu'au premier Essai, ensuite le Positionnement est figé.

**Dérivation, sans jargon : la « copie modifiée »** (EN *modified copy* ; consigné dans `CONTEXT.md`). La fiche d'un Positionnement qui a servi dans un Essai affiche « 🔒 Figé : utilisé dans n Essais », avec la raison (« pour que les Battles comparent ce qui a vraiment été envoyé ») et la marche à suivre. Ses actions :
- **Créer une copie modifiée…** (bouton plein) : le même formulaire, pré-rempli, intitulé « (copie) ». Une note dit que l'original reste tel quel (et reste Champion le cas échéant), et que la copie est un nouveau Positionnement, modifiable jusqu'à son premier Essai. Après création : « pour le tester, ouvre une Battle à <Étape> » ;
- **Corriger le libellé** : réservé aux fautes de frappe, s'applique partout, Essais et Historique compris.
Un Positionnement jamais utilisé propose Modifier, Dupliquer… (même formulaire de copie) et Supprimer.

**Archivage et suppression** (consignés dans `CONTEXT.md`) :
- **Archiver à la main** : possible pour un Positionnement qui n'est ni Champion ni dans une Battle ouverte, en plus de l'archivage automatique du battu ; « Désarchiver » le rend disponible ;
- **Supprimer** : seulement s'il n'a jamais été utilisé, avec annulation proposée dans la notification. Une fois utilisé, même sans Essai, on l'archive. **Attention au dev** : figé et supprimable ne coïncident pas. Un Positionnement utilisé hors Battle (sans Essai) reste modifiable, mais il n'est plus supprimable ;
- les archivés restent dans leur lignée, masqués derrière « Afficher les archivés (n) », avec le motif (« battu par … le … », « archivé à la main »), et restent consultables.

**Retours vers le parcours d'origine** : le formulaire s'ouvre directement, Étape verrouillée, avec un bandeau qui dit d'où l'on vient. Son bouton plein reprend la suite :
- depuis l'**assistant d'ouverture d'une Battle** (« + Créer un Positionnement ») : **« Créer et revenir à la Battle »**. L'assistant reprend à l'étape 1, avec ce Positionnement choisi comme Challenger ;
- depuis le **geste central** sur une Étape sans Positionnement : **« Créer et l'envoyer à <Contact> »**. Le panneau du geste central reprend avec ce Positionnement ;
- « Annuler et revenir » ramène au parcours d'origine sans rien créer.

**Exigences pour la stack** : téléverser et stocker les pièces jointes d'un Positionnement (leur téléchargement est déjà requis par le ticket « Geste central : utiliser un Positionnement ») ; une suppression annulable juste après coup.
