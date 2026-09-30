# Relance faite : aide-mémoire du message

Type: grilling
Status: resolved
Blocked by: 

## Question

Quand l'Utilisateur fait une Relance (« J'ai relancé » depuis une carte du Funnel, « Faite » depuis l'écran « Aujourd'hui », la fiche Contact ou la palette), que lui montre l'app pour l'aider à relancer, et que doit porter le modèle de domaine pour ça ?

À trancher :
- **Modèle** : aujourd'hui, un Positionnement porte une Cadence de relance (des intervalles), mais **aucun texte de relance**. Doit-il porter un message par Relance de sa Cadence (« Relance 1 : … », « Relance 2 : … ») ? Ce texte fait-il partie de ce qui est figé et comparé dans une Battle, comme la Cadence ? Ou reste-t-il un simple aide-mémoire hors de la Battle ? La réponse se consigne dans `CONTEXT.md`, et en ADR si elle le mérite.
- **Geste** : « J'ai relancé » en un clic, ou un petit panneau façon « Envoyer à » (le rappel de ce qui a été envoyé, le texte de la Relance à copier avec le prénom remplacé, la date de la Relance faite, la Relance suivante planifiée par la Cadence) ? L'un par défaut, l'autre à la demande ?
- Une Relance sans Positionnement derrière (planifiée à la main, hors Essai) : que montrer ?

Contexte : le ticket « Vue Funnel : kanban et table » met le raccourci « J'ai relancé » sur les cartes à Relance due ; Romain a suggéré d'y joindre « le mémo du Positionnement, pour voir et copier le message de relance ».

## Answer

Tranché avec Romain le 2026-09-30.

**Modèle** (consigné dans `CONTEXT.md`, pas d'ADR : le choix prolonge le gel déjà acté pour la Cadence) :
- Un **Positionnement porte un message de relance facultatif par rang de sa Cadence** (« Relance 1 : … », « Relance 2 : … »), prénom remplacé à l'affichage. Les messages sont **figés** avec le Positionnement dès son premier Essai et comparés dans la Battle, comme la Cadence : les modifier revient à dériver un nouveau Positionnement. On a écarté la simple description (pas de message) et l'aide-mémoire modifiable hors Battle (il fausserait la comparaison sans trace).
- **La Relance ne référence toujours aucun Positionnement.** Son message est une lecture : celui du rang de la Relance, tiré de la dernière utilisation d'un Positionnement sur le Contact, tant que la Cadence court. Une Relance hors Cadence (« Relancer quand même » après le dernier rang, ajout manuel, Relance planifiée après une Interaction entrante qui a arrêté la Cadence) n'a pas de message.
- Une **Relance peut porter une note libre** (« rappeler pour le devis »). Elle reste sur l'Interaction une fois la Relance faite, donc visible dans la timeline de la fiche Contact.

**Geste : « Relancer… »** (EN *Follow up…*), un seul libellé partout. Il remplace « Faite » (écran « Aujourd'hui ») et « J'ai relancé » (cartes du Funnel), et sert aussi depuis la fiche Contact et la palette. Il ouvre un **panneau latéral « Relancer <Contact> »** calqué sur le geste central, en 2 étapes :
1. **Envoie-le** : le rappel de ce qui a été envoyé et quand (Positionnement, date), le canal, le message du rang à copier et les pièces jointes. Sans message, on y voit la note de la Relance et la dernière Interaction sortante.
2. **Confirme** : la date (aujourd'hui, hier ou une autre, qui peut précéder la saisie) et la note modifiable, puis le récapitulatif : +1 à l'Activité du jour de l'Interaction, puis la Relance suivante à sa date ou « puis le Délai de réponse » si la Cadence est épuisée.

`F` ouvre le panneau, `Entrée` valide, et une notification propose d'annuler. Pas de « Faite » en un clic à côté : il ferait double emploi et sauterait la date. Reporter, Annuler et « A répondu… » restent les actions secondaires.

**Adapter le message** au moment d'envoyer (retoucher le texte copié) n'est ni proposé dans le panneau ni tracé : c'est la responsabilité de l'Utilisateur, comme « ne tester qu'une chose à la fois ».

**Renvois** : la saisie des messages par rang relève de la « Gestion des Positionnements » ; la saisie de la note à la planification d'une Relance relève de la fiche Contact (« Planifier une Relance »). La forme mobile du panneau revient au ticket « Parcours mobile ».
