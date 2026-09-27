# Cycle de vie d'un Essai et définition de son succès

Type: grilling
Status: resolved
Blocked by:

## Question

Quand un Essai est-il un succès ou un échec, et comment passe-t-il d'un état à l'autre ?

Point de départ (piste de Romain) : validation manuelle via un bouton « positionnement validé » ; si le Contact change d'Étape pendant un Essai en cours, une popup demande succès ou échec.

À trancher :
- Le critère de succès est-il défini **par Battle** (par ex. « a répondu », « a demandé un entretien ») pour que les validations manuelles restent cohérentes ?
- Le **silence** : un Essai sans nouvelle depuis N jours devient-il automatiquement un échec (délai par Battle ? par Étape ?), ou reste-t-il en cours indéfiniment ?
- Un Essai peut-il être annulé ou exclu (erreur, Contact hors cible) sans compter comme échec ?
- Un Contact peut-il avoir plusieurs Essais en cours (Étapes différentes) ? Deux Essais dans la même Battle ?
- Changer d'Étape sans Essai en cours : rien ne se passe ?

## Comments

- Cadrage (2026-09-26) : la suppression d'un Contact **supprime ses Essais en cours** et **garde ses Essais passés**, comptabilisés dans les Battles mais anonymisés (Positionnement, issue, dates, sans donnée personnelle). À intégrer dans la réponse à « annulé / exclu ».
- Cadrage (2026-09-26) : le silence est à trancher en lien avec les Relances, voir [Interactions, Relances et rattachement aux Essais](06-interactions-relances-essais.md).

- Interactions, Relances et rattachement aux Essais (2026-09-26) : **amende** cette réponse. Le délai de réponse n'est plus modifiable en cours de Battle : il fait partie de la Cadence de relance du Positionnement (figée avec lui), et il désigne désormais l'attente après la dernière Relance prévue. Voir [Interactions, Relances et rattachement aux Essais](06-interactions-relances-essais.md).

- Cadrage des échecs dans le modèle (2026-09-27) : **amende le vocabulaire** de cette réponse, pas son fond : « échec » (issue d'un Essai) → **sans suite**, État « perdu » → **clos**, Positionnement « perdant » → **battu**. Voir [Cadrage des échecs dans le modèle](09-cadrage-des-echecs.md).

## Answer

Tranché en grilling avec Romain (2026-09-26). Termes intégrés à `CONTEXT.md` (Essai, Critère de succès, Délai de réponse).

- **Naissance** : l'Essai commence quand l'Utilisateur confirme avoir utilisé le Positionnement, et le délai de réponse démarre ce jour-là. Une proposition de l'app ignorée ne crée pas d'Essai (seule une dérogation est tracée).
- **Issues** : en cours, succès, échec, **annulé** (avec un motif, non compté dans la Battle). La suppression d'un Contact supprime ses Essais en cours (ils ne passent pas en « annulé ») et garde ses Essais passés, anonymisés.
- **Critère de succès par Battle** : pré-rempli depuis la Battle précédente de l'Étape, figé à l'ouverture. Le succès est validé à la main.
- **Silence** : délai de réponse par Battle (14 jours par défaut, modifiable en cours de Battle), compté depuis la dernière Interaction. Une fois dépassé, l'app affiche le **signal** « délai dépassé » (ce n'est pas une issue) et l'Utilisateur confirme l'échec. Rien n'est automatique.
- **Cardinalité** : au plus un Essai en cours par Contact, rattaché à son Étape actuelle ; jamais deux Essais du même Contact dans une même Battle, même en cas de reprospection.
- **Changement d'Étape pendant un Essai** : une popup propose succès par défaut vers l'avant (y compris en sautant des Étapes), échec vers l'arrière ; « annulé » est toujours possible. Sans Essai en cours, seule l'Interaction de changement d'Étape est enregistrée.
- **Succès sans changement d'Étape** : l'app propose de faire avancer le Contact, sans l'imposer.
- **Correction** : l'issue reste modifiable tant que la Battle est ouverte, puis elle est figée ; une réponse tardive devient une simple Interaction.
- **Hors Battle** : utiliser un Positionnement sans Battle ouverte ne crée pas d'Essai ; on note seulement quel Positionnement a été utilisé.
