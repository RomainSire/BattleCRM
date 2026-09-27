# Méthode statistique pour désigner le vainqueur d'une Battle (petits échantillons)

Recherche pour le ticket `issues/01-methode-statistique-petits-echantillons.md`.
Tous les chiffres des tableaux ont été calculés (formule exacte d'Evan Miller pour P(A > B), Monte-Carlo pour les intervalles et la perte attendue, simulations à 3 000 répétitions pour la puissance et le peeking). Les simulations sont des ordres de grandeur : ±2 points.

## TL;DR

- À 10–25 Essais par Positionnement, **les tests fréquentistes (Fisher, z-test) ne concluent presque jamais** : il faudrait ~60 Essais par Positionnement pour détecter 10 % vs 30 %, ~200 pour 10 % vs 20 %.
- Le **modèle bayésien bêta-binomial** reste utilisable et, surtout, **interprétable** : « il y a 88 % de chances que A soit meilleur que B ». Il ne crée pas d'information : il dit honnêtement ce qu'on sait.
- « A a 85 % » doit vouloir dire **P(A > B) ≥ 0,85**, accompagné de l'intervalle de l'écart, et combiné à un **minimum d'Essais et de succès** pour éviter les faux vainqueurs en regardant en continu.
- Le Champion est le choix par défaut : en cas d'égalité, **il garde son titre**.

## 1. Fréquentiste vs bayésien à cette taille

### Fréquentiste

Le test exact de Fisher (Agresti, *Categorical Data Analysis*, 3e éd., §3.5) est le test correct pour des tableaux 2×2 à petits effectifs ; le z-test (approximation normale) n'est pas valide quand les effectifs attendus sont < 5, ce qui est le cas ici (Agresti, §3.5 ; règle de Cochran).

Problème : sa puissance est dérisoire à notre taille. Taille nécessaire par Positionnement (α = 0,05 bilatéral, puissance 80 %, formule classique pour deux proportions, cf. Evan Miller, *How Not To Run an A/B Test* et son calculateur) :

| Taux réels A vs B | Essais nécessaires **par** Positionnement |
|---|---|
| 10 % vs 30 % | ~62 |
| 20 % vs 40 % | ~81 |
| 15 % vs 30 % | ~120 |
| 5 % vs 15 % | ~140 |
| 10 % vs 20 % | ~199 |

Avec 10–25 Essais par Positionnement, même un écart énorme (8/25 vs 3/25, soit 32 % vs 12 %) donne p = 0,17 (tableau §2). Le verdict fréquentiste serait « non significatif » pour quasiment toutes les Battles : correct, mais inutilisable pour décider. Et une p-value n'est pas « la probabilité que A soit meilleur », ce qui la rend difficile à expliquer à l'Utilisateur.

### Bayésien bêta-binomial

Chaque Positionnement a un taux de succès inconnu `p`. Avec un a priori Beta(1, 1) (uniforme) et `s` succès sur `n` Essais, l'a posteriori est Beta(1 + s, 1 + n − s) (Gelman et al., *Bayesian Data Analysis*, 3e éd., ch. 2.1–2.4 : modèle binomial conjugué). On en déduit :

- **P(A > B)** : calculable exactement en forme close (Evan Miller, *Formulas for Bayesian A/B Testing*, 2014, https://www.evanmiller.org/bayesian-ab-testing.html) — pas besoin de simulation côté app.
- **Intervalle de crédibilité de l'écart p_A − p_B** (Monte-Carlo ou approximation).
- **Perte attendue** E[max(p_B − p_A, 0)] si on choisit A : « combien je perds en moyenne si je me trompe ». C'est le critère de décision de VWO SmartStats (Chris Stucchio, *Bayesian A/B Testing at VWO*, 2015, https://vwo.com/downloads/VWO_SmartStats_technical_whitepaper.pdf).

Le bayésien ne « gagne » pas en puissance par magie : il accepte de conclure avec une confiance plus faible (85 % au lieu de 95 %) et l'**affiche explicitement**. C'est exactement ce qu'on veut : une décision pragmatique et honnête sur son incertitude.

## 2. Tableau : P(A > B) sur des résultats plausibles

A priori Beta(1, 1) sur chaque Positionnement. IC 90 % = intervalle de crédibilité à 90 % de l'écart p_A − p_B en points de pourcentage. Perte(A) = perte attendue si on choisit A.

| A | B | P(A > B) | IC 90 % de l'écart | Perte si on choisit A | Perte si on choisit B | Fisher p (bilatéral) |
|---|---|---|---|---|---|---|
| 2/10 | 1/10 | **0,707** | [−17,7 ; +34,6] | 2,9 pts | 11,3 pts | 1,000 |
| 1/12 | 0/12 | **0,760** | [−10,6 ; +26,6] | 1,6 pts | 8,7 pts | 1,000 |
| 3/15 | 1/15 | **0,834** | [−8,6 ; +32,7] | 1,1 pts | 12,9 pts | 0,598 |
| 3/12 | 1/12 | **0,839** | [−9,8 ; +38,8] | 1,3 pts | 15,6 pts | 0,590 |
| 6/20 | 3/20 | **0,861** | [−7,1 ; +34,2] | 0,9 pts | 14,5 pts | 0,451 |
| 5/20 | 2/20 | **0,881** | [−5,5 ; +33,1] | 0,7 pts | 14,4 pts | 0,407 |
| 4/25 | 1/25 | **0,905** | [−2,9 ; +26,1] | 0,4 pts | 11,6 pts | 0,349 |
| 10/25 | 5/25 | **0,934** | [−1,8 ; +38,3] | 0,4 pts | 18,9 pts | 0,217 |
| 8/25 | 3/25 | **0,951** | [+0,1 ; +36,9] | 0,2 pts | 18,8 pts | 0,171 |
| 15/50 | 7/50 | **0,972** | [+2,1 ; +28,6] | 0,1 pts | 15,5 pts | 0,090 |

Lecture :
- Un seuil à 85 % est franchi autour de « 5 contre 2 sur 20 » ou « 4 contre 1 sur 25 ». Un seuil à 95 % demande « 8 contre 3 sur 25 ».
- Les intervalles restent **très larges** (souvent 40 points) : on peut dire *qui* est probablement meilleur, pas *de combien*.
- 3/12 vs 1/12 et 3/15 vs 1/15 donnent presque la même probabilité : **le nombre de succès pèse plus que le nombre d'Essais** quand les taux sont bas.

## 3. Que veut dire « A a 85 % » ?

| Lecture | Avantage | Inconvénient |
|---|---|---|
| **P(A > B) ≥ 0,85** | Une seule phrase compréhensible (« 85 % de chances que A soit meilleur ») ; calcul exact. | Ne dit rien de l'ampleur ; peut être atteint par hasard si on regarde souvent (§5). |
| Intervalle de crédibilité à 85 % excluant 0 | Montre l'ampleur et l'incertitude. | À ~20 Essais, l'intervalle est toujours énorme ; plus dur à expliquer ; équivaut grosso modo à P(A > B) ≥ 0,925 (unilatéral), donc plus strict. |
| Gain relatif (« A fait +150 % ») | Parlant. | Instable à petits effectifs (1/12 vs 0/12 = « +∞ % ») ; trompeur. **À éviter.** |
| P(A > B + δ) (écart minimal utile, ROPE de Kruschke) | Évite de déclarer un vainqueur pour un écart négligeable. | Demande de fixer δ ; exige encore plus de données. Kruschke, *Rejecting or Accepting Parameter Values in Bayesian Estimation*, AMPPS 2018, doi:10.1177/2515245918771304. |

**Recommandation** : « 85 % » = P(A > B) ≥ 0,85. Afficher à côté les taux observés (« 5/20 vs 2/20 ») et une phrase d'incertitude (« l'écart réel est probablement entre −5 et +33 points »), jamais un gain relatif.

## 4. Combien d'Essais pour conclure (seuil 0,85, horizon fixe)

Probabilité de déclarer le bon vainqueur (et entre parenthèses le mauvais) si on regarde **une seule fois** après n Essais par Positionnement :

| Taux réels A vs B | n = 10 | n = 15 | n = 20 | n = 25 | n = 50 | n = 100 |
|---|---|---|---|---|---|---|
| 30 % vs 10 % | 46 % (1 %) | 61 % (1 %) | 73 % (0 %) | 77 % (0 %) | 93 % | 100 % |
| 40 % vs 20 % | 42 % (2 %) | 58 % (1 %) | 59 % (1 %) | 69 % (0 %) | 88 % | 98 % |
| 30 % vs 15 % | 34 % (2 %) | 45 % (2 %) | 54 % (2 %) | 58 % (1 %) | 79 % | 93 % |
| 15 % vs 5 % | 29 % (2 %) | 39 % (2 %) | 47 % (1 %) | 54 % (1 %) | 74 % | 91 % |
| 20 % vs 10 % | 28 % (3 %) | 33 % (3 %) | 41 % (3 %) | 48 % (2 %) | 64 % | 84 % |

Ordres de grandeur à retenir :
- À 20–25 Essais par Positionnement, on détecte **un écart du simple au triple** (10 % vs 30 %) dans ~3 cas sur 4.
- Un écart du simple au double (10 % vs 20 %) reste **une pièce qui tombe à pile ou face** même à 25 Essais.
- Le risque de **désigner le mauvais** est faible (≤ 3 %). Le vrai risque est ailleurs : désigner un vainqueur **alors qu'il n'y a pas de différence** (§5).

Quand les deux Positionnements sont en réalité équivalents, un seuil à 0,85 regardé une seule fois désigne quand même un « vainqueur » dans ~20–30 % des cas (seuil 0,95 : ~5–11 %). C'est inhérent au seuil : 0,85 signifie qu'on accepte ~15 % d'erreur de chaque côté. Conséquence pratique limitée : si A et B sont équivalents, choisir l'un ou l'autre ne coûte rien — c'est précisément ce que mesure la perte attendue (Stucchio 2015, §« expected loss »).

## 5. Peeking et arrêt anticipé

L'Utilisateur verra les chiffres évoluer à chaque Essai. Regarder en continu et s'arrêter dès que le seuil est franchi gonfle fortement les faux vainqueurs :

- Côté fréquentiste, c'est l'avertissement classique d'Evan Miller (*How Not To Run an A/B Test*, 2010, https://www.evanmiller.org/how-not-to-run-an-ab-test.html) et de Johari et al. (*Peeking at A/B Tests*, KDD 2017, arXiv:1512.04922).
- Côté bayésien, la probabilité a posteriori reste « calibrée » si l'a priori reflète la réalité (Deng, Lu & Chen, *Continuous Monitoring of A/B Tests without Pain*, IEEE DSAA 2016), mais un **seuil de décision fixe** n'est pas immunisé : David Robinson (*Is Bayesian A/B Testing Immune to Peeking? Not Exactly*, 2015, http://varianceexplained.org/r/bayesian-ab-testing/) montre que le taux de faux vainqueurs augmente aussi. Il recommande de décider sur la **perte attendue** plutôt que sur P(A > B) seul.

Simulation, deux Positionnements **équivalents**, on regarde après chaque paire d'Essais jusqu'à 25 par Positionnement :

| Règle d'arrêt | Faux vainqueur (taux réel 10 %) | Faux vainqueur (taux réel 20 %) |
|---|---|---|
| Seuil 0,85, dès le 1er Essai | 55 % | 70 % |
| Seuil 0,85, ≥ 10 Essais par Positionnement | 47 % | 56 % |
| Seuil 0,85, ≥ 10 Essais par Positionnement **et ≥ 5 succès au total** | 23 % | 52 % |
| Seuil 0,90, ≥ 15 Essais et ≥ 5 succès | 19 % | 34 % |
| Seuil 0,95, ≥ 10 Essais et ≥ 5 succès | 8 % | 21 % |

Et quand il y a **vraiment** un écart (jusqu'à 25 Essais, avec peeking) :

| Règle | 30 % vs 10 % : bon / mauvais | 20 % vs 10 % : bon / mauvais |
|---|---|---|
| 0,85, ≥ 10 Essais, ≥ 5 succès | 84 % / 1 % | 53 % / 4 % |
| 0,90, ≥ 15 Essais, ≥ 5 succès | 76 % / 1 % | 45 % / 2 % |
| 0,95, ≥ 10 Essais, ≥ 5 succès | 65 % / 0 % | 31 % / 1 % |

Enseignements :
- Le **minimum d'Essais et de succès** est le garde-fou le plus rentable ; il coûte peu de puissance.
- Même avec garde-fous, les faux vainqueurs restent fréquents sous peeking. Ce n'est acceptable **que** parce que (a) désigner le mauvais est rare (≤ 4 %), (b) un faux vainqueur entre équivalents ne coûte rien, et (c) le modèle Champion/Challenger remet le titre en jeu à la Battle suivante.
- Evan Miller (*Simple Sequential A/B Testing*, 2015, https://www.evanmiller.org/sequential-ab-testing.html) propose une règle séquentielle fréquentiste propre (« arrêter quand l'écart de succès atteint 2√N »), mais elle suppose un N planifié de l'ordre de la centaine : hors de portée ici.

## 6. Égalité et abandon

- **Horizon maximal** : fixer d'avance un nombre maximal d'Essais par Positionnement (par ex. 25). Si le seuil n'est pas atteint : **égalité**.
- **Égalité → le Champion garde son titre.** Le Challenger n'a pas prouvé sa supériorité ; changer a un coût (habitude, cohérence). C'est la logique de « l'hypothèse par défaut » et de la perte attendue : en cas de doute, rester sur l'option en place.
- **Arrêt anticipé pour égalité** : si les deux pertes attendues sont sous un seuil d'indifférence (par ex. < 1 point de taux de succès) après le minimum d'Essais, les deux se valent en pratique → égalité (Stucchio 2015 : critère « threshold of caring » ; Kruschke 2018 : ROPE). À ces tailles cela se produira rarement ; l'horizon maximal fait l'essentiel du travail.
- **Abandon** : si après l'horizon maximal il y a < 3 succès au total, la Battle n'apprend rien (taux trop bas pour cette Étape) → signaler « données insuffisantes, tester une Étape plus haute dans le Funnel ou un écart plus marqué entre Positionnements ».

## 7. Allocation

| Méthode | Pour | Contre |
|---|---|---|
| Alternance stricte (A, B, A, B…) | Simple ; équilibre garanti. | Biais possible si l'ordre des Contacts est corrélé à leur qualité (ex. les meilleurs Contacts d'abord). |
| **Aléatoire équilibrée** (tirage au sort, ou blocs de 2 mélangés) | Protège contre les biais de sélection ; reste équilibré. | Un peu moins intuitif. |
| Thompson sampling (Russo et al., *A Tutorial on Thompson Sampling*, 2018, arXiv:1707.02038) | Minimise les échecs pendant la Battle en envoyant plus souvent le probable meilleur. | Conçu pour des milliers de tirages ; à 20–50 Contacts, il déséquilibre les bras et **réduit la capacité à conclure** ; il suppose que c'est l'algorithme qui choisit. |

Le point décisif : **c'est l'humain qui choisit à qui envoyer quoi**. S'il choisit librement, il enverra inconsciemment son Positionnement préféré aux meilleurs Contacts, et la Battle mesurera ses choix, pas les Positionnements (biais de sélection ; Kohavi, Tang & Xu, *Trustworthy Online Controlled Experiments*, 2020, ch. 2–3 sur la randomisation). L'app doit donc **proposer** le Positionnement à utiliser pour chaque nouveau Contact (tirage aléatoire équilibré), l'Utilisateur pouvant forcer exceptionnellement (à tracer).

## Recommandation

1. **Méthode** : bayésien bêta-binomial, a priori Beta(1, 1) par Positionnement, P(A > B) calculée par la formule exacte d'Evan Miller. Pas de test fréquentiste (inutilisable à 10–25 Essais par Positionnement).
2. **« 85 % »** = P(Challenger > Champion) ≥ 0,85 (ou ≤ 0,15 pour une victoire du Champion). Afficher avec les comptes bruts (« 5/20 vs 2/20 ») et l'intervalle de l'écart ; jamais de gain relatif.
3. **Minimum avant verdict** : ≥ 10 Essais terminés par Positionnement **et** ≥ 5 succès au total. Seuil 0,85 réglable par l'Utilisateur (0,90–0,95 pour les plus prudents).
4. **Arrêt** : verdict dès que le seuil est franchi après le minimum (peeking assumé, garde-fous ci-dessus) ; horizon maximal par défaut 25 Essais par Positionnement.
5. **Égalité** : horizon atteint sans verdict → égalité, **le Champion garde son titre** ; < 3 succès au total → « données insuffisantes ».
6. **Allocation** : l'app propose le Positionnement par tirage aléatoire équilibré (blocs de 2) ; pas de Thompson sampling ; les dérogations manuelles sont tracées.
7. **Honnêteté affichée** : dire à l'Utilisateur qu'à ce volume on ne détecte fiablement qu'un écart important (du simple au triple), et qu'un « vainqueur » à 85 % peut être un Positionnement simplement équivalent.

## Sources

- Evan Miller, *How Not To Run an A/B Test* (2010) — https://www.evanmiller.org/how-not-to-run-an-ab-test.html
- Evan Miller, *Formulas for Bayesian A/B Testing* (2014) — https://www.evanmiller.org/bayesian-ab-testing.html
- Evan Miller, *Simple Sequential A/B Testing* (2015) — https://www.evanmiller.org/sequential-ab-testing.html
- Chris Stucchio, *Bayesian A/B Testing at VWO* (2015), whitepaper — https://vwo.com/downloads/VWO_SmartStats_technical_whitepaper.pdf
- David Robinson, *Is Bayesian A/B Testing Immune to Peeking? Not Exactly* (2015) — http://varianceexplained.org/r/bayesian-ab-testing/
- Johari, Pekelis, Walsh, *Always Valid Inference: Bringing Sequential Analysis to A/B Testing* / *Peeking at A/B Tests* (KDD 2017) — arXiv:1512.04922
- Deng, Lu, Chen, *Continuous Monitoring of A/B Tests without Pain: Optional Stopping in Bayesian Testing* (IEEE DSAA 2016) — arXiv:1602.05549
- Russo, Van Roy, Kazerouni, Osband, Wen, *A Tutorial on Thompson Sampling* (2018) — arXiv:1707.02038
- Kruschke, *Rejecting or Accepting Parameter Values in Bayesian Estimation*, AMPPS 1(2), 2018 — doi:10.1177/2515245918771304
- Gelman, Carlin, Stern, Dunson, Vehtari, Rubin, *Bayesian Data Analysis*, 3e éd., CRC Press 2013, ch. 2
- Agresti, *Categorical Data Analysis*, 3e éd., Wiley 2013, §3.5 (test exact de Fisher)
- Kohavi, Tang, Xu, *Trustworthy Online Controlled Experiments*, Cambridge University Press 2020

Calculs : scripts Python (bibliothèque standard uniquement) — formule exacte d'Evan Miller pour P(A > B), Monte-Carlo (200 000 tirages) pour intervalles et pertes, simulations (3 000 répétitions par scénario) pour puissance et peeking.
