# Gestes de changement d'État, « Ajouter au Cercle… » et « Prendre des nouvelles… »

Type: grilling
Status: resolved
Blocked by: 01

## Question

Comment se présentent les gestes qui font changer d'État et le nouveau geste sur un Allié, en remplacement de la fenêtre de conséquences (§6.6), de « Sans suite et proposition de clore » (§6.7) et de « Réactiver… » (§6.11) de la spec UX ?

À trancher :
- Fenêtre de conséquences vers Vivier, Allié, Archivé : Essai à régler (choix proposés), Relance annulée, motif (facultatif ? obligatoire pour Archivé ?), récapitulatif.
- « Faire entrer » (Vivier → En prospection) : choix de l'Étape, enchaînement sur le geste central ; « Réactiver… » d'un Archivé : vers quel État par défaut ?
- « Ajouter au Cercle… » : déclencheurs (fiche, palette, proposition après un Essai réussi à la dernière Étape ou après « A répondu… »), et ce que dit la fenêtre.
- « Prendre des nouvelles… » : champs (Canal, note), lien avec la Relance planifiée facultative d'un Allié, notification.
- Une Interaction entrante d'un Contact du Vivier ou Archivé (réponse spontanée) : « A répondu… » propose-t-il de le faire entrer ou de l'ajouter au Cercle ?
- Zones d'État du glisser-déposer du kanban (Vivier, Allié, Archivé) ; filtre « Hors prospection active » du Funnel.
- Bouton plein de la fiche selon l'État ; verbes de la palette (« prendre des nouvelles de jul »).

## Answer

Tranché avec Romain le 2026-10-06 (grilling). Le glossaire n'est pas modifié : il couvrait déjà ces points (motif facultatif pour tout changement d'État, Relance annulée en quittant En prospection, « à traiter » réservé aux Contacts En prospection).

**Une fenêtre, un verbe par destination** (remplace §6.6 pour l'État, §6.7 et §6.11)
- Quatre verbes ouvrent la même fenêtre de conséquences, déjà réglée sur leur cible : **Faire entrer…** (vers En prospection), **Remettre au Vivier…**, **Ajouter au Cercle…** et **Archiver…** (EN *Bring in…, Back to Pool…, Add to Circle…, Archive…*). « Changer d'État… » (EN *Change status…*) reste dans `⋯`, dans la palette, sur la pastille d'État et dans la table, et commence par le choix de la cible. **« Réactiver… » disparaît.**
- **Quitter En prospection** : l'Essai en cours doit être réglé (Succès, Sans suite ou Annulé, ce dernier avec un motif). Le choix présélectionné dépend de la cible : Succès vers Allié, Sans suite vers Vivier, aucun vers Archivé. La Relance annulée n'est pas une case à cocher, c'est une ligne du récapitulatif. Le motif est facultatif partout.
- **Faire entrer…** (depuis Vivier ou Archivé) : l'Étape (la dernière atteinte par défaut, à choisir obligatoirement si elle est archivée ou si le Contact n'en a pas), puis « Enchaîner : utiliser un Positionnement maintenant », cochée si l'Étape a une Battle ouverte, sinon le lien « Planifier une Relance… ». Récapitulatif : « Entrée n°3 cette semaine (3/5) ». `Entrée` valide puis enchaîne. Depuis le bandeau Entrées d'Aujourd'hui, c'est la même fenêtre.
- **Ajouter au Cercle…** :
  - depuis En prospection : l'Essai à régler (Succès proposé), la Relance annulée, « garde sa dernière Étape atteinte : <Étape> » ;
  - depuis Vivier ou Archivé : rien à régler ;
  - partout : le motif facultatif, le lien « Planifier une Relance… » et le récapitulatif « Cercle 8/10 · prochaines nouvelles d'ici le <date> (Rythme 28 j) » ;
  - depuis la page Cercle : on choisit d'abord un Contact dans une liste filtrée à la frappe, sans les Alliés. Sans résultat, on propose l'ajout rapide en Allié.
- **Après un Succès à la dernière Étape**, dans « A répondu… » comme dans la fenêtre de conséquences, la ligne d'Étape propose **« Ajouter au Cercle »** (présélectionné) ou « Rester En prospection à <Étape> ».
- **Après un Essai sans suite** (remplace §6.7) : Remettre au Vivier (**présélectionné**), Garder En prospection ou Archiver. Microcopie : « Remettre <Contact> au Vivier ? Il reviendra dans les propositions d'entrée. »

**Prendre des nouvelles…** (EN *Check in…*)
- Le panneau comprend le canal (E-mail, LinkedIn, Téléphone, Rencontre, Autre), la date (aujourd'hui, hier, autre), une note facultative, le récapitulatif « +1 à l'Activité · Jours sans contact remis à 0 · prochaines nouvelles d'ici le <date> » et le lien « Planifier une Relance… ». Il se termine par une notification avec « Annuler ».
- **Relance d'un Allié** :
  - si elle est due ou en retard, le geste affiché est **Relancer…** (§6.3), et la note de la Relance sert d'aide-mémoire ;
  - si elle est à venir, « Prendre des nouvelles… » propose « Garder la Relance du <date> » (par défaut) ou « L'annuler ».
  - Une Prise de nouvelles ne consomme jamais la Relance.
- **Sur un Allié, « Noter une Interaction » devient « Prendre des nouvelles… »**, à la même place et avec la même touche `I` : selon le glossaire, toute Interaction sortante libre faite auprès d'un Allié est une Prise de nouvelles, donc elle compte dans l'Activité. Pour un Contact du Vivier ou Archivé, §6.4 ne change pas (hors Activité).

**Réponse spontanée** (« A répondu… » sans Essai en cours)
- Vivier ou Archivé : « Laisser au Vivier » ou « Laisser archivé » (présélectionné), « Faire entrer » (avec l'Étape et l'enchaînement) ou « Ajouter au Cercle ».
- Allié : aucun choix d'État. Les Jours sans contact repartent de la réponse, et le lien « Planifier une Relance… » est proposé.

**Funnel**
- Zones d'État pendant le glisser : **Vivier**, **Cercle** et **Archivé**. Chacune ouvre la fenêtre réglée sur sa cible.
- Le filtre d'État, la ligne « Masqués : … » et la ligne « Hors prospection active » sont supprimés. Le Funnel ne montre que les Contacts En prospection.

**Ajout rapide** : une commande segmentée **Vivier · En prospection · Allié**, sur Vivier par défaut, jamais retenue d'une fois sur l'autre. Le champ Étape n'apparaît que pour En prospection. `Ctrl Entrée` force En prospection et enchaîne sur le geste central.

**Fiche : bloc Prochaine action et bouton plein selon l'État** (En prospection inchangé)
- Vivier : « Au Vivier · dernière Étape : <Étape> » (ou « jamais entré »), bouton plein **Faire entrer…**.
- Allié : « Allié · n j sans contact » avec la jauge du Rythme (ou la Relance planifiée), bouton plein **Relancer…** si une Relance est due, sinon **Prendre des nouvelles…**.
- Archivé : fiche grisée, avec le motif et la phrase « Rien n'est définitif : tu peux le faire revenir ». Bouton plein **Faire entrer…**, et en secondaire Remettre au Vivier… et Ajouter au Cercle….
- Les autres verbes d'État sont sous `⋯`, sans celui de l'État actuel.

**Raccourcis** : sur un Allié, `F` ouvre l'action plein du moment (Relancer… ou Prendre des nouvelles…) et `I` ouvre Prendre des nouvelles…. Nouvelle touche **`S`** : Changer d'État… sur la fiche et sur une carte du Funnel qui a le focus. Pas de touche par verbe d'État.

**Palette**
- Les actions d'un Contact sont filtrées par son État : Faire entrer…, Remettre au Vivier…, Ajouter au Cercle…, Archiver…, Prendre des nouvelles… (Allié seulement), Changer d'État….
- Verbe d'abord : un mot du verbe suffit (« nouvelles jul », « cercle jul », « entrer jul », « archiver jul », « vivier jul »).
- Sans saisie : les Contacts à traiter et les Alliés à relancer, mêlés par ancienneté du retard.

**Pastille d'Aujourd'hui** : on garde le glossaire tel quel. La pastille n'affiche qu'un nombre ; l'infobulle et le libellé accessible disent « 3 à traiter, 2 Alliés à relancer ».

**Écran Contacts**
- Puces : **Tous** (par défaut, **sans les Archivés**, avec une ligne « n archivés · Afficher »), Vivier, En prospection, Alliés, Archivés.
- Ligne :
  - Vivier : « Organisation · Vivier » ;
  - Allié : « Organisation · Allié » avec les Jours sans contact, en couleur seulement à partir de « bientôt » ;
  - Archivé : grisé, avec le motif.

**Renvois et microcopie**
- **Geste central hors En prospection** :
  - Vivier ou Archivé : « Faire entrer et continuer » (par défaut) ou « Enregistrer sans Essai » ;
  - Allié : aucun garde-fou d'État. Le geste est enregistré sans Essai ; c'est une Action de prospection, qui remet les Jours sans contact à 0.
- **Supprimer le Contact…** propose **Archiver** à la place.
- **Notifications** (avec « Annuler ») :
  - « <Contact> entre dans le Funnel à <Étape> · Entrées 3/5 » ;
  - « <Contact> entre au Cercle · 8/10 » ;
  - « <Contact> est remis au Vivier » ;
  - « <Contact> est archivé » ;
  - « Nouvelles de <Contact> notées · prochaines d'ici le <date> ».
- **Aujourd'hui** : « Contacts sans prochaine action » s'applique aux Contacts En prospection (là où la spec disait « actifs »).
