# 39: Objectif d'activité et célébration

**What to build:** la colonne latérale d'Aujourd'hui montre l'Activité du jour face à l'Objectif (jauge, graphe des 4 dernières semaines, lien « Indicateurs → ») ; au franchissement de l'Objectif, une seule fois par jour sur tous les appareils, des confettis partent de l'endroit de l'Action et le toast « Bravo, objectif du jour atteint ! 3 / 3 » s'affiche. Sources : spec UX §2 (célébration), §5.1 ; CONTEXT (Activité, Objectif d'activité) ; ADR 0011 ; ST-41, ST-42, ST-44, ST-53, ST-56, ST-69.

**Blocked by:** 37, 20

**Status:** ready-for-agent

- [ ] Activité = Actions de prospection comptées au jour local de l'Interaction ; Objectif en vigueur ce jour-là
- [ ] Jauge (« atteint » une fois l'Objectif atteint, rien sans Objectif) et graphe des 4 dernières semaines (intensité seule)
- [ ] Fait « célébration du jour » enregistré côté serveur par jour local, porté par le résumé ; jamais défait par « Annuler »
- [ ] ~40 confettis (teal, vert, gris) ~1,5 s, halo sur la carte d'Activité, coupés par `prefers-reduced-motion` (le toast reste), annoncés dans la région live ; désactivables par le réglage
- [ ] Aucun enregistrement d'un Objectif manqué ; pas de paliers
