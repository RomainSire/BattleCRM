# Détachement des réponses négatives dans l'UX

Type: grilling
Status: resolved
Blocked by: 01

## Question

Comment l'interface aide-t-elle l'Utilisateur à vivre un Essai sans suite comme un point de donnée, et à valoriser son effort plutôt que ses taux ?

À trancher :
- Célébration de l'Objectif d'activité atteint : forme, intensité, fréquence (une fois par jour ?).
- Microcopie des moments sensibles : Essai sans suite, Contact clos, Positionnement battu, Verdict égalité ou données insuffisantes.
- Ce qui est **mis en avant** et ce qui est discret : Activité et volume contre taux de succès ; une série de « sans suite » ne doit jamais se lire comme un échec personnel.
- Place du graphe d'Activité façon GitHub (écran « Aujourd'hui » ou écran d'indicateurs).

## Answer

Tranché en grilling avec Romain le 2026-09-29. Aucun changement de `CONTEXT.md` (tout relève de la présentation), pas d'ADR.

**Ton de la microcopie.**
- **Tutoiement** partout en français. Ton de pair, factuel, jamais familier ni enjoué à outrance.
- **Registre factuel et informatif** aux moments sensibles : dire ce que l'événement *apporte* (une donnée, une progression), sans consoler ni féliciter. Pas d'encouragements (« la prochaine sera la bonne ! »), qui sonnent creux et confirment l'échec. Une phrase stable par situation, pas de formules tournantes.

**Moments sensibles.**
- **Essai sans suite** : « Essai sans suite : un point de donnée de plus pour la Battle “<Étape>” (14/20 terminés). » On montre la progression de la Battle, jamais un compteur de « sans suite ».
- **Proposition de clore après un « sans suite »** (écran « Aujourd'hui ») : « Clore <Contact> ? Tu pourras le réactiver à tout moment. » Motif optionnel ; boutons **Clore** et **Garder actif**, **Garder actif** par défaut.
- **Positionnement battu** : on mène par la progression. D'abord « X devient Champion de “<Étape>” », puis en second plan « Y est archivé, il peut revenir comme Challenger ». Pour un titre défendu : « Y garde son titre ; X est archivé. » Le mot « battu » reste dans le modèle mais ne sert jamais de titre à l'écran.
- **Égalité** : « Pas d'écart détectable entre X et Y : à ce volume, seul un écart important se voit. Les deux se valent probablement ; X garde son titre. »
- **Données insuffisantes** : « Trop peu de succès pour départager X et Y. »
- Pour ces deux Verdicts, le champ Enseignement est mis en avant (« Qu'en retiens-tu ? »), toujours facultatif.

**Rendu visuel.** Asymétrique : un succès peut être mis en valeur par la couleur ; « sans suite » est neutre (libellé ou point gris), jamais signalé comme une anomalie (ni rouge, ni icône d'alerte, ni ✗). Un Contact clos s'affiche en gris, avec son motif s'il existe ; la fiche rappelle qu'il peut redevenir actif.

**Effort avant taux.**
- Les taux de succès n'apparaissent **que comme comparaison entre deux Positionnements**, dans le détail d'une Battle (jauge, onglet « Par Cible ») : une propriété d'un Positionnement, jamais de l'Utilisateur. Jamais de taux de réponse global ni de taux de refus personnel, et jamais sur « Aujourd'hui ».
- Ce qui est mis en avant partout : l'Activité (jour, semaine), les Essais terminés, la progression des Battles.
- Les taux de passage entre Étapes restent permis, en second plan : ils décrivent le Funnel, pas une personne.
- **Série de « sans suite »** : aucune détection, aucun message ; aucun historique du type « tes 5 derniers Essais ».

**Célébration de l'Objectif d'activité.**
- **Une fois par jour, au franchissement** : une brève animation (confettis légers, ~1,5 s) et « Bravo, objectif du jour atteint ! » avec le chiffre, là où l'Action de prospection a été enregistrée. Ensuite, la jauge reste simplement « atteint ».
- **Pas de paliers** : un dépassement se lit dans le chiffre (« 5 / 3 ») sans autre célébration.
- Sur mobile, la célébration se fond dans l'écran « journée bouclée » quand il s'affiche.
- **Interrupteur séparé** dans les Réglages : « Célébrer l'Objectif atteint », activé par défaut, indépendant de la désactivation de l'Objectif.
- Le rendu exact (couleurs, animation) revient au ticket « Direction visuelle ».

**Graphe d'Activité façon GitHub.**
- Codage : **intensité selon le nombre d'Actions de prospection** ; jour vide en case neutre, jamais « manqué » ; **pas de marque « Objectif atteint »** (redondante avec l'intensité, selon Romain) ; **aucun compteur de série**.
- Emplacement : les 4 dernières semaines sur « Aujourd'hui » (acquis). La vue longue et l'existence même d'un écran d'indicateurs relèvent du ticket « Écrans d'indicateurs et d'Activité ».

**Exigences pour la stack** : persister la préférence « Célébrer l'Objectif atteint » par Utilisateur ; savoir qu'une célébration a déjà eu lieu ce jour-là (dans le fuseau de l'Utilisateur) pour ne pas la rejouer, y compris sur un autre appareil.
