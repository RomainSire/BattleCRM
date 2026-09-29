# Geste central : utiliser un Positionnement

Type: prototype
Status: resolved
Blocked by: 

## Question

Comment l'Utilisateur enregistre-t-il l'utilisation d'un Positionnement sur un Contact, surtout quand l'Étape de ce Contact a une Battle ouverte (tirage équilibré, naissance de l'Essai) ?

À trancher :
- **Avant ou après** : l'app propose le Positionnement tiré (« envoie-lui le CV B ») et l'Utilisateur confirme l'avoir utilisé, ou il enregistre après coup ce qu'il a envoyé ?
- Si l'Utilisateur n'a **pas suivi** la proposition : refus, avertissement, re-tirage ? Comment préserver la validité de la Battle sans bloquer ?
- Accès au contenu du Positionnement au moment de l'envoi (texte à copier, pièce jointe à télécharger).
- Signal d'un Contact déjà exposé ; Contact non actif ; Étape sans Battle ouverte (Interaction sans Essai).
- Enchaînement : la première Relance planifiée selon la Cadence est-elle affichée ou confirmée à ce moment ?
- Déclencheurs : depuis la fiche Contact, le kanban, l'écran « Aujourd'hui », la palette de commandes.

## Assets

- Prototype jetable (variantes A, A2, B, C ; 7 cas ; état affiché) : branche `prototype/02-utiliser-positionnement`, fichier `.scratch/battlecrm-ux/prototypes/02-utiliser-positionnement.html` (`git show prototype/02-utiliser-positionnement:.scratch/battlecrm-ux/prototypes/02-utiliser-positionnement.html > /tmp/p.html`, puis `?variant=A2`).

## Answer

Tranché avec Romain le 2026-09-29, sur le prototype.

**Chemin : la proposition d'abord** (variante A, dans la forme A2). L'app révèle le Positionnement tiré au sort, l'Utilisateur l'envoie puis confirme « C'est envoyé ». On a écarté la déclaration après coup (B) et le passage par un état « à envoyer » (C). Une utilisation passée reste possible : on la saisit par le même geste, en choisissant sa date.

**Forme : un panneau latéral en 3 étapes numérotées**, avec l'en-tête « Envoyer à <Contact> » et une ligne discrète pour l'Étape et la Battle :
1. **Quoi envoyer** : le Positionnement en gros, avec le badge « tiré au sort ». Une phrase explique pourquoi : la Battle répartit au hasard pour que la comparaison reste juste.
2. **Envoie-le** : le canal, le texte prêt à copier (prénom déjà remplacé) et les pièces jointes à télécharger.
3. **Confirme** : la date d'envoi (aujourd'hui, hier ou une autre date, qui peut précéder la saisie), puis le **récapitulatif des conséquences** : Essai commencé ou « sans Essai », Relance 1 à sa date avec « déjà en retard » si la date est ancienne, et +1 à l'Activité du jour de l'Interaction.
Ensuite viennent le bouton « C'est envoyé » (`Entrée`) et le lien « Plus tard ». La clarté de lecture vient de cette hiérarchie en étapes ; on la garde.

**Dérogation au tirage** : le lien « J'ai utilisé <l'autre> à la place » ouvre un **motif optionnel**. Le badge devient « ton choix » et la dérogation est tracée sur l'Essai. Jamais de refus ni de re-tirage.

**Tirage réservé** : une fois révélé, le tirage est attaché au Contact. « Plus tard » le garde, et rouvrir le geste montre le même Positionnement. Il n'y a pas de re-tirage, pour qu'on ne puisse pas relancer le tirage jusqu'à obtenir celui qu'on préfère.

**Relance 1** : affichée dans le récapitulatif, avec un lien « modifier » (un écart à la Cadence, tracé sur l'Essai). Il n'y a pas d'étape de confirmation.

**Garde-fous, dans le panneau :**
- **Contact non actif** (Battle ouverte) : l'action principale est « Réactiver et continuer », l'action secondaire « Enregistrer sans Essai ».
- **Essai en cours ailleurs** : on le règle dans le geste (Succès, Sans suite, Annulé…), avec le rappel du Critère de succès, puis on continue.
- **Déjà un Essai dans cette Battle** : une note l'explique. Pas de nouvel Essai, pas de tirage, choix libre.
- **Contact déjà exposé** : une ligne d'information (« déjà exposé à CV A le 12 mars : sans suite »). Le tirage n'en tient pas compte.
- **Étape sans Battle ouverte** : le Champion est proposé, avec un choix possible parmi les Positionnements de l'Étape. L'Interaction est enregistrée **sans Essai**, dans le même panneau.
- **Étape sans Positionnement** : le geste est bloqué. On propose « Créer un Positionnement pour cette Étape » ou « Noter une Interaction libre ».

**Déclencheurs** : le même panneau s'ouvre depuis la fiche Contact (bouton, touche `U`), la palette (`Ctrl K`, « Utiliser un Positionnement · <Contact> », ou choisir un Contact) et l'écran « Aujourd'hui » (action principale du bloc « Contacts sans prochaine action »). Depuis le Funnel, c'est le ticket « Vue Funnel : kanban et table » qui décide (par exemple, enchaîner sur ce panneau après un changement d'Étape vers une Étape à Battle ouverte).

**Après** : une notification (« Envoyé à Claire : « CV B », Essai commencé. Relance 1 le 1ᵉʳ oct. ») avec un lien « Annuler ». L'Interaction apparaît en tête de la fiche.

**Exigences pour la stack** : copier dans le presse-papiers ; télécharger les pièces jointes d'un Positionnement ; annuler juste après un enregistrement.
