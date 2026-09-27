# Interactions, Relances et rattachement aux Essais

Type: grilling
Status: resolved
Blocked by: 02

## Question

Comment les Interactions (dont les Relances) s'articulent-elles avec les Essais, et quel rôle joue le temps dans le modèle ?

Acquis du cadrage (2026-09-26) :
- Une **Relance** est une Interaction planifiée qui s'inscrit dans l'Essai en cours ; elle ne crée pas de nouvel Essai. Romain juge ce concept temporel **essentiel**.
- Chaque changement d'Étape est enregistré comme une Interaction datée (historique du Funnel pour les indicateurs).

À trancher :
- Types d'Interaction : liste fermée, ouverte, ou aucune typologie ?
- Une Interaction est-elle toujours rattachée à un Essai quand un Essai est en cours ? Que sont les Interactions hors Battle ?
- Qu'est-ce qu'une Relance « en retard », et que se passe-t-il ?
- Une Relance réalisée devient-elle une Interaction passée (même objet), ou crée-t-elle une Interaction distincte ?
- Articulation avec le silence : N Relances sans réponse, ou un délai après la dernière Relance, font-ils de l'Essai un échec (voir le ticket 02) ?
- L'envoi d'un Positionnement (par ex. le mail B) est-il lui-même l'Interaction qui ouvre l'Essai ?

## Comments

- Cycle de vie de l'Essai (2026-09-26) : le délai de réponse est compté depuis la **dernière Interaction**, donc une Relance repousse l'échéance. Reste à préciser ici si c'est la Relance planifiée ou la Relance effectuée qui compte. Reste aussi à décider comment noter le Positionnement utilisé hors Battle (Interaction qui référence un Positionnement ?). Voir [Cycle de vie d'un Essai et définition de son succès](02-cycle-de-vie-essai.md).

- Sortie du Funnel et état d'un Contact (2026-09-26) : un Contact en pause garde ses Relances, et la pause peut porter une date de reprise sous forme de Relance « reprendre contact » ; passer en perdu ou gagné propose d'annuler les Relances futures. Une Relance peut donc exister **sans Essai en cours** (Contact en pause ou gagné), ce qui nuance « la Relance s'inscrit dans l'Essai en cours ». Les changements d'État sont aussi des Interactions. Voir [Sortie du Funnel et état d'un Contact](05-sortie-du-funnel-etat-contact.md).

## Answer

Tranché en grilling avec Romain (2026-09-26). Nouveau terme **Cadence de relance** dans `CONTEXT.md` ; précisés : Interaction, Relance, Essai, Délai de réponse.

- **Typologie** : seule typologie du modèle, le **sens** : *sortante* (l'Utilisateur a fait) ou *entrante* (le Contact a réagi). Le canal est porté par le Positionnement ; ailleurs, une étiquette libre facultative, hors modèle. L'app enregistre elle-même les Interactions de parcours : utilisation d'un Positionnement, changement d'Étape, changement d'État.
- **Utilisation d'un Positionnement** : c'est une Interaction sortante qui référence le Positionnement. Dans une Battle ouverte, elle fait commencer l'Essai, à sa date. Hors Battle, elle garde seulement la trace du Positionnement utilisé (point laissé ouvert par le ticket 02).
- **Rattachement** : une Interaction appartient au **Contact**, jamais explicitement à un Essai ; les Interactions d'un Essai se déduisent des dates (au plus un Essai en cours par Contact).
- **Relance = même objet** : une Interaction sortante future, *planifiée*, puis *faite* (datée du jour réel) ou *annulée*. Elle ne référence jamais de Positionnement (renvoyer un autre Positionnement = nouvelle utilisation), ne crée jamais d'Essai, et peut exister sans Essai en cours (pause, gagné, hors Battle).
- **En retard** : une Relance planifiée dont la date est passée est signalée « en retard » (signal, pas statut) ; elle reste ainsi jusqu'à être faite, replanifiée ou annulée. Rien d'automatique.
- **Cadence de relance** (demande de Romain : plusieurs Relances par Essai, 3 en général, sans l'imposer) : une suite d'intervalles, chacun compté **depuis la dernière Interaction faite**, par défaut 3, 7 puis 14 jours. Portée par le **Positionnement** (voir l'amendement ci-dessous).
- **Planification** : une Relance à la fois ; quand une Relance est faite, l'app planifie la suivante, jusqu'au bout de la Cadence. Les Relances planifiées restent annulables.
- **Délai de réponse, redéfini** : l'attente **après la dernière Relance prévue** (14 jours par défaut ; sans Relance prévue, il part de l'utilisation). Tant que la Cadence n'est pas épuisée, un silence appelle la Relance suivante, pas « délai dépassé ». Seule une Interaction **faite** (dans les deux sens) repousse les échéances ; planifier ne repousse rien. Pas de règle « N Relances = échec » : l'Utilisateur confirme toujours l'échec.
- **Réponse entrante sans succès** au milieu de la Cadence : le compteur de Relances ne repart pas de zéro, la Relance suivante est replanifiée depuis la date de la réponse.
- **Délai et Cadence figés** avec le Positionnement : corrige le ticket 02, qui laissait le délai modifiable en cours de Battle.
- **Dates et corrections** : date d'une Interaction modifiable (aujourd'hui par défaut) ; antidater une utilisation fait commencer l'Essai à cette date. Interactions saisies modifiables et supprimables ; Interactions de parcours (Étape, État) non supprimables, on corrige par un nouveau changement. Supprimer l'utilisation qui a fait commencer un Essai oblige à régler cet Essai (annulé).

### Amendement : la Cadence fait partie du Positionnement (2026-09-26)

Idée de Romain après la clôture : la façon de relancer peut être **l'objet même d'une Battle** (CV A + 3/7/14 contre CV A + 2/4/7). Remplace « Cadence par Étape, figée par la Battle ».

- **Cadence dans le Positionnement** : un Positionnement est une façon de se présenter **et de relancer** ; il porte sa Cadence de relance, figée avec lui dès son premier Essai. Changer la Cadence = nouveau Positionnement, dérivé du précédent. Plus de Cadence par Étape ni de gel par la Battle : l'égalité de traitement au sein d'un bras découle du gel du Positionnement.
- **Pré-remplissage** : depuis le Positionnement dont il dérive, sinon avec la Cadence par défaut (+3, +7, +14, puis 14 jours) : c'est ainsi que l'app guide.
- **Délai de réponse dans la Cadence** : il fait aussi partie du Positionnement (la patience est testable). Une Cadence complète se lit « +3, +7, +14, puis abandon après 14 jours ».
- **Hors Battle** : les Relances suivent la Cadence du Positionnement utilisé ; les Relances sans Positionnement (« reprendre contact ») restent manuelles.
- **Écart** : sauter ou ajouter une Relance pour un Contact reste possible, mais c'est dévier de la chose testée : l'écart est **tracé sur l'Essai**, qui reste compté ; la Battle affiche le nombre d'Essais avec écart.
- **Contenu des Relances** : la Cadence ne porte que des délais ; canal ou message de chaque Relance restent du texte libre dans la description du Positionnement.
