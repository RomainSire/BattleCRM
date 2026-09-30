# Enregistrer une réponse du Contact

Type: prototype
Status: resolved
Blocked by: 02, 03

## Question

Que se passe-t-il quand l'Utilisateur indique qu'un Contact a répondu, via le bouton « A répondu… » d'une Relance sur l'écran « Aujourd'hui », sur la fiche Contact ou depuis la palette de commandes ?

À trancher :
- Saisie de l'**Interaction entrante** : champs minimaux (date, qui peut précéder la saisie ; canal ; note), et ce qu'on peut sauter.
- Sort de la **Relance planifiée** : annulée d'office, proposée à l'annulation, ou conservée ?
- Si un **Essai est en cours** : proposer de le régler tout de suite (succès au regard du Critère de succès de la Battle, sans suite pour un refus), ou le laisser en cours ?
- **Enchaînement** sur un changement d'Étape (la réponse fait souvent avancer le Contact) et, si l'Étape d'arrivée a une Battle ouverte, sur le geste central (tranché : panneau en 3 étapes qui règle déjà un Essai en cours ailleurs, voir le ticket « Geste central : utiliser un Positionnement »).
- Réponse négative : proposer de clore le Contact, comme après un Essai sans suite ?

## Assets

- Prototype jetable (variantes A, B, C ; 4 cas ; état affiché) : branche `prototype/10-enregistrer-reponse`, fichier `.scratch/battlecrm-ux/prototypes/10-enregistrer-reponse.html` (`git show prototype/10-enregistrer-reponse:.scratch/battlecrm-ux/prototypes/10-enregistrer-reponse.html > /tmp/p.html`, puis `?variant=A&cas=essai`).

## Answer

Tranché avec Romain le 2026-09-30, en grilling puis sur le prototype.

**Modèle.** Une Interaction entrante ne porte **aucune nature** (positive, négative, neutre). La seule question posée est ce que la réponse fait à l'Essai, au regard du Critère de succès de la Battle, qui varie d'une Battle à l'autre. Une Interaction entrante **arrête la Cadence de relance** : l'app ne planifie plus de Relance d'elle-même, et l'Utilisateur peut toujours en planifier une à la main. Si l'Essai reste en cours, le Délai de réponse court à partir de cette Interaction entrante (« délai dépassé » s'il ne se passe plus rien). La Cadence se compte désormais depuis la dernière Interaction **sortante**. Tout cela est consigné dans `CONTEXT.md` (Cadence de relance, Délai de réponse). Pas d'ADR.

**Forme : un panneau latéral en 3 étapes numérotées** (variante A), avec l'en-tête « <Contact> a répondu », comme le panneau « Envoyer à… » du geste central. On a écarté la fenêtre compacte (B) et la carte qui se déplie avec des intentions en un clic (C).
1. **Sa réponse** : la date (aujourd'hui par défaut, hier, autre ; elle peut précéder la saisie), le canal (pré-rempli avec celui du dernier Positionnement utilisé, modifiable) et une note facultative. Rien d'autre n'est obligatoire.
2. **L'Essai** (seulement s'il y en a un en cours) : le Positionnement, la Battle et le rappel du Critère de succès, puis Succès, Sans suite ou Laisser en cours (touches `1`, `2`, `3`). **Rien n'est présélectionné** : c'est le point de donnée de la Battle, on ne valide pas sans l'avoir réglé. Après **Sans suite**, la ligne « Clore <Contact> ? Tu pourras le réactiver à tout moment. » propose **Garder actif** (par défaut) ou **Clore** (motif facultatif).
3. **Et ensuite** :
   - la case « Annuler la Relance n planifiée », **cochée par défaut** ; le lien « Planifier une Relance… » (date libre) ;
   - la ligne Étape : **Avancer à <Étape suivante> si Succès**, **Rester sinon**, ou une autre Étape ;
   - si l'Étape d'arrivée a une Battle ouverte, la case « Enchaîner : utiliser un Positionnement maintenant », **cochée par défaut** : à la validation, le panneau « Envoyer à <Contact> » s'ouvre. C'est la même logique que le glisser-déposer du Funnel ;
   - sans Essai en cours, la proposition de clore reste disponible, repliée sous « État… ».
   - Puis le **récapitulatif des conséquences** (Interaction entrante, issue de l'Essai, date de « délai dépassé » s'il reste en cours, Relance annulée ou conservée, changement d'Étape ou d'État, enchaînement). Il ne mentionne pas que la réponse est hors Activité : inutile.

Ensuite viennent le bouton « Enregistrer la réponse » (`Entrée`, inactif tant que l'Essai n'est pas réglé) et « Annuler ».

**Après** : une notification avec « Annuler ». Après un Sans suite, elle reprend la phrase tranchée : « Essai sans suite : un point de donnée de plus pour la Battle “<Étape>” (14/20 terminés). »

**Déclencheurs** : le même panneau s'ouvre depuis le bouton « A répondu… » d'une Relance (écran « Aujourd'hui », carte du Funnel), depuis la fiche Contact et depuis la palette (« A répondu · <Contact> »). Sans Relance planifiée, la case d'annulation disparaît ; sans Essai en cours, l'étape 2 disparaît et « Et ensuite » devient l'étape 2.

**Périmètre.** Ce panneau est le mode **entrant** d'un geste plus général « Noter une Interaction ». Le mode sortant (appel, rencontre hors Positionnement) relève de la fiche Contact.

**Exigences pour la stack** : rien de nouveau (annuler juste après un enregistrement, déjà notée).
