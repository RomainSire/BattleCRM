# 32: Clôturer une Battle et Historique des Champions

**What to build:** l'Utilisateur clôt une Battle par une fenêtre qui présélectionne le Verdict de la Règle de victoire, lui permet de désigner un autre vainqueur après avertissement ou d'abandonner, annonce les conséquences et recueille un Enseignement ; l'onglet Historique des Champions montre ensuite la lignée de chaque Étape. Sources : spec UX §5.5, §6.9 (clôture), §10 ; CONTEXT (Verdict, Champion, Historique des Champions, Enseignement) ; ADR 0001.

**Blocked by:** 31

**Status:** ready-for-agent

- [ ] Verdicts : victoire du Challenger, titre défendu, égalité, données insuffisantes, abandonnée ; « désigné par l'Utilisateur » quand la règle n'est pas satisfaite (case « Je désigne ce vainqueur quand même ») ; « Clôturer quand même… » sur une Battle non concluante
- [ ] Conséquences dans une transaction : Champion, perdant archivé (« battu par … le … »), Challenger d'une Battle abandonnée laissé disponible, Essais en cours annulés « Battle clôturée » sans toucher aux Relances, Tirages réservés tombés
- [ ] Confirmation, pas d'« Annuler » ; Enseignement facultatif, mis en avant pour égalité et données insuffisantes, modifiable ensuite
- [ ] Microcopie de la spec UX §6.9 et §10 ; « Battu » n'est jamais un titre à l'écran
- [ ] Historique des Champions : une lignée par Étape, Champion, date, Enseignement, Verdict sur les flèches ; prouvé (fond teal) / désigné (hachuré, pointillés) / titre conservé (neutre), écrit en toutes lettres, avec légende
- [ ] Mobile : consultation et clôture
