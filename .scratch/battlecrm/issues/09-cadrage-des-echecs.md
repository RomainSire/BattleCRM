# Cadrage des échecs dans le modèle

Type: grilling
Status: resolved
Blocked by:

## Question

Qu'est-ce que le **modèle** (pas l'UX) doit porter pour qu'un échec soit vécu comme un point de donnée neutre, conformément à l'exigence « aider à se détacher des réponses négatives » ?

À trancher :
- Vocabulaire : « échec » est-il le bon terme dans le glossaire, ou un terme plus neutre (par ex. « sans suite ») ? Idem pour « perdu ».
- Quels indicateurs le modèle doit rendre calculables pour valoriser le volume plutôt que le rejet (Essais terminés, Relances faites, progression vers l'Horizon, Historique des Champions) ?
- Comment qualifier une Battle ouverte « pas encore concluante », et les Verdicts égalité et données insuffisantes, pour qu'ils se lisent comme un apprentissage ?
- Frontière avec l'UX : consigner ici ce qui relève du modèle et renvoyer le reste à la spec suivante (hors destination).

## Answer

Tranché en grilling avec Romain (2026-09-27). Termes intégrés à `CONTEXT.md` (renommés : Essai, État, Positionnement, Délai de réponse ; nouveaux : **Enseignement**, **Action de prospection**, **Activité**, **Objectif d'activité**). Pas d'ADR : rien de difficile à changer.

- **Vocabulaire** : l'issue « échec » d'un Essai devient **sans suite** (silence ou refus) ; l'État « perdu » devient **clos** (motif optionnel) ; un Positionnement « perdant » devient **battu**. Les noms des Verdicts ne changent pas (factuels ; « titre défendu » est déjà positif). Amende le vocabulaire des réponses de [Cycle de vie d'un Essai et définition de son succès](02-cycle-de-vie-essai.md), [Cycle de vie d'une Battle : ouverture, participants, répartition](03-cycle-de-vie-battle.md), [Règle de victoire et clôture d'une Battle](04-regle-de-victoire.md) et [Sortie du Funnel et état d'un Contact](05-sortie-du-funnel-etat-contact.md), sans rien changer à leur fond.
- **Enseignement** : note libre optionnelle sur une Battle close, saisie à la clôture puis modifiable, affichée dans l'Historique des Champions, hors de tout calcul. Une égalité ou « données insuffisantes » se lit ainsi comme un apprentissage.
- **Valoriser l'effort plutôt que le taux de succès** : le modèle mesure l'**Activité**, nombre d'**Actions de prospection** (utilisations de Positionnement + Relances faites ; jamais les Interactions entrantes ni les changements d'Étape ou d'État) par jour, à la date de l'Interaction, dans le fuseau de l'Utilisateur ; total hebdomadaire dérivé.
- **Objectif d'activité** : par jour, un seul par Utilisateur, 1 par défaut (« faire un truc chaque jour »), désactivable ; modification effective le lendemain, historique des valeurs conservé, pas de rétroactivité. Rien de punitif : seuls réalisé et objectif du jour sont retenus, aucune issue « non atteint », pas de jours « off ».
- **Autres indicateurs de volume** déjà calculables sans ajout : Essais terminés, progression vers le minimum et l'Horizon, Historique des Champions.
- **Renvoyé à la spec UX** (hors destination) : graphe d'activité journalier façon GitHub, total de la semaine en cours et semaine par semaine, célébration (confettis, « BRAVO ») quand l'Objectif du jour est atteint et rien sinon ; formulations des popups, pas de rouge pour « sans suite », mise en avant du volume plutôt que du taux de refus, message « seul un écart important est détectable à ce volume ».
