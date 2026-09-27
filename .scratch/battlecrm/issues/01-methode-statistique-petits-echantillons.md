# Méthode statistique pour désigner le vainqueur d'une Battle sur un petit échantillon

Type: research
Status: resolved
Blocked by:

## Question

Avec 20 à 50 Contacts par Battle (donc environ 10 à 25 Essais par Positionnement) et des taux de succès probablement faibles (5 à 30 %), quelle méthode permet de désigner un vainqueur de façon honnête et compréhensible ?

À couvrir :
- Fréquentiste (test exact de Fisher, z-test) vs **bayésien bêta-binomial** (P(A > B), perte attendue). Lequel reste utilisable et interprétable à cette taille d'échantillon ?
- Que peut vouloir dire « A a 85 % » : P(A > B) ≥ 0,85 ? Un intervalle de crédibilité ? Un gain relatif ? Conséquences de chaque lecture.
- Nombre de succès et d'Essais nécessaires pour conclure selon différents écarts réels (par ex. 10 % vs 30 %) : tableau d'ordres de grandeur.
- Regarder les résultats en continu (peeking) et arrêt anticipé : risques et garde-fous (seuil + nombre minimum d'Essais, perte attendue).
- Cas « pas de vainqueur » : quand déclarer une égalité ou abandonner une Battle.
- Allocation : alternance stricte, aléatoire, ou Thompson sampling ? Est-ce pertinent quand c'est l'humain qui choisit à qui envoyer quoi ?

Livrable : `.scratch/battlecrm/research/01-methode-statistique.md` avec sources primaires et une recommandation.

## Comments

- Recherche disponible : ../research/01-methode-statistique.md

## Answer

Détail et sources : [../research/01-methode-statistique.md](../research/01-methode-statistique.md). Faits établis, sur lesquels s'appuieront « Règle de victoire et clôture d'une Battle » (seuils définitifs) et « Cycle de vie d'une Battle » (répartition) :

- **Fréquentiste inutilisable** à 10–25 Essais par Positionnement (~60 Essais par Positionnement pour détecter 10 % vs 30 %). **Bayésien bêta-binomial** (a priori Beta(1, 1), P(A > B) en forme close d'Evan Miller) : utilisable et interprétable.
- **« 85 % » = P(Challenger > Champion) ≥ 0,85**, affiché avec les comptes bruts (« 5/20 vs 2/20 ») et l'intervalle de l'écart ; jamais de gain relatif (instable à petits effectifs).
- **Ordres de grandeur** : à 20–25 Essais par Positionnement on détecte un écart du simple au triple ~3 fois sur 4 ; du simple au double reste un pile ou face. Désigner le *mauvais* est rare (≤ 4 %) ; désigner un vainqueur entre deux Positionnements *équivalents* est fréquent (20–50 % sous peeking), mais ne coûte rien et le titre est remis en jeu.
- **Peeking** : le bayésien n'en est pas immunisé avec un seuil fixe. Garde-fou le plus rentable : **minimum ≥ 10 Essais terminés par Positionnement et ≥ 5 succès au total** avant tout verdict.
- **Égalité / abandon** : horizon maximal (proposé : 25 Essais par Positionnement) ; horizon atteint sans verdict → égalité, **le Champion garde son titre** ; < 3 succès au total → « données insuffisantes ».
- **Allocation** : l'humain qui choisit librement introduit un biais de sélection ; recommandation : l'app **propose** le Positionnement par tirage aléatoire équilibré (blocs de 2), dérogation manuelle possible mais tracée. Pas de Thompson sampling (déséquilibre les bras à cette taille).
- Honnêteté affichée : dire qu'à ce volume seul un écart important est détecté de façon fiable.
