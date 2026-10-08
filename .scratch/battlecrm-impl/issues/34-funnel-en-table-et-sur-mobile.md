# 34: Funnel en table et sur mobile

**What to build:** `V` bascule le Funnel en vue table (Contact, Organisation, Cible, Étape modifiable en ligne, Essai en cours, prochaine Relance, date d'entrée dans l'Étape), triable, par urgence par défaut ; le choix est retenu par appareil. En largeur étroite, le Funnel est une liste groupée par Étape. Sources : spec UX §5.2 ; ST-55.

**Blocked by:** 33

**Status:** ready-for-agent

- [ ] Table triable, urgence par défaut ; Étape modifiable en ligne via la fenêtre de conséquences ; mêmes filtres que le kanban
- [ ] `V` (coupé avec les raccourcis à une touche) ; dernier choix kanban/table en `localStorage`, lu sans planter
- [ ] Mobile : liste groupée par Étape, sans glisser-déposer ni table ; on change d'Étape depuis la fiche
- [ ] axe sans erreur dans les deux thèmes
